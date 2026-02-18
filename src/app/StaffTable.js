"use client";
import { useState, useMemo, useEffect } from 'react';
import { manageStaffRecord, commitMonthlyBatch, issueStrike, getDiscordQueries, getForumTallies } from './actions';

export default function StaffTable({ initialData }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const [isPrepModal, setIsPrepModal] = useState(false);
  const [isAddModal, setIsAddModal] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [rankModal, setRankModal] = useState({ isOpen: false, name: "", role: "Support" });

  const [prepText, setPrepText] = useState("");
  const [prepDate, setPrepDate] = useState(new Date().toISOString().substring(0, 7) + "-01");
  const [stagedRows, setStagedRows] = useState([]);
  
  const [formState, setFormState] = useState({ name: "", role: "Support", discord: "" });
  const [lookupName, setLookupName] = useState("");
  const [lookupTotal, setLookupTotal] = useState("");
  const [waivedStrikes, setWaivedStrikes] = useState([]); 

  const [processingName, setProcessingName] = useState(null);
  const [actionStatus, setActionStatus] = useState(null);
  
  const [discordQueries, setDiscordQueries] = useState({});
  const [forumTallies, setForumTallies] = useState({});

  useEffect(() => {
    getDiscordQueries().then(setDiscordQueries);
    getForumTallies().then(setForumTallies);
  }, []);

  const availableMonths = useMemo(() => {
    const months = initialData.map(d => d.date?.substring(0, 7)).filter(Boolean);
    return [...new Set(months)].sort().reverse();
  }, [initialData]);

  const [startMonth, setStartMonth] = useState(availableMonths[0] || "");
  const [endMonth, setEndMonth] = useState(availableMonths[0] || "");

  const careerStats = useMemo(() => {
    const stats = {};
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6);
    initialData.forEach(r => {
      if (!stats[r.name]) stats[r.name] = { loaTotal: 0, strikes6Mo: 0, strikeDetails: [] };
      stats[r.name].loaTotal += Number(r.loa) || 0;
      if (new Date(r.date) >= cutoff && Number(r.strike) > 0) {
        stats[r.name].strikes6Mo += Number(r.strike);
        stats[r.name].strikeDetails.push(`${r.date.substring(0, 7)}: ${r.strike} Strike(s)`);
      }
    });
    return stats;
  }, [initialData]);

  const displayData = useMemo(() => {
    const rangeData = initialData.filter(s => {
      const month = s.date.substring(0, 7);
      const isSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const isSenior = s.senior === 'TRUE';
      const isRole = roleFilter === "All" || (roleFilter === "Senior" && isSenior) || (roleFilter === "Support" && !isSenior);
      const inRange = month >= startMonth && month <= endMonth;
      return isSearch && isRole && inRange;
    });

    const aggregated = {};
    rangeData.forEach(s => {
      if (!aggregated[s.name]) {
        aggregated[s.name] = { ...s, newIG: 0, newForum: 0, newDiscord: 0, strike: 0, loa: 0 };
      }
      aggregated[s.name].newIG += Number(s.newIG);
      aggregated[s.name].newForum += Number(s.newForum);
      aggregated[s.name].newDiscord += Number(s.newDiscord);
      aggregated[s.name].strike += Number(s.strike);
      aggregated[s.name].loa += Number(s.loa);
    });

    let result = Object.values(aggregated);

    result.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'number' || !isNaN(Number(aVal))) {
        return sortConfig.direction === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [initialData, search, roleFilter, startMonth, endMonth, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const topAgents = useMemo(() => {
    const sorted = (key) => [...displayData].sort((a, b) => Number(b[key]) - Number(a[key]))[0];
    return { ig: sorted('newIG'), forum: sorted('newForum'), discord: sorted('newDiscord') };
  }, [displayData]);

  function handleProcessPrep() {
    const lines = prepText.split('\n');
    let processed = [];
    const knownStaff = [...new Set(initialData.map(r => r.name))].sort((a, b) => b.length - a.length);

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      if (!/(Support|Senior)/i.test(line)) continue;

      const parts = line.replace(/\t/g, ' ').split(/\s+/).filter(Boolean);

      let rankIndex = -1;
      for (let j = parts.length - 1; j >= 0; j--) {
        if (/^(Support|Senior)$/i.test(parts[j])) {
          rankIndex = j;
          if (j > 0 && /^Senior$/i.test(parts[j-1])) {
            rankIndex = j - 1;
          }
          break;
        }
      }

      if (rankIndex >= 3) {
        const totalIG = parts[rankIndex - 1];
        const qRej = parts[rankIndex - 2];
        const qAcc = parts[rankIndex - 3];
        
        let rawAlias = parts.slice(0, rankIndex - 3).join(" ");
        let alias = rawAlias.replace(/~[a-z]~/gi, "").trim();

        let matchedName = alias;
        let lastMonthRecord = null;

        for (const staff of knownStaff) {
          if (alias.toLowerCase().includes(staff.toLowerCase())) {
            matchedName = staff; 
            lastMonthRecord = initialData.filter(r => r.name === staff).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
            break;
          }
        }

        if (!lastMonthRecord) {
            lastMonthRecord = initialData.filter(r => r.name.toLowerCase() === matchedName.toLowerCase()).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        }

        if (matchedName && !isNaN(Number(totalIG))) {
          
          // Calculates Auto-Tallied Forum Reports with FUZZY MATCHING (ignores numbers/symbols)
          let calcTotalForum = 0;
          const cleanTargetName = matchedName.toLowerCase().replace(/[^a-z]/g, '');
          const cleanTargetAlias = alias.toLowerCase().replace(/[^a-z]/g, '');

          for (const [tName, count] of Object.entries(forumTallies)) {
             const cleanTName = tName.replace(/[^a-z]/g, '');
             
             if (tName === matchedName.toLowerCase() || 
                 tName === alias.toLowerCase() || 
                 (cleanTName && cleanTName === cleanTargetName) || 
                 (cleanTName && cleanTName === cleanTargetAlias)) {
                 calcTotalForum += count;
             }
          }

          processed.push({
            'Date': prepDate, 
            'Staff Name': matchedName, 
            'Senior': lastMonthRecord?.senior || 'FALSE',
            'Quizzes Accepted': qAcc, 
            'Quizzes Rejected': qRej, 
            'Total Reports Completed': Number(totalIG),
            'Total Forum Reports': calcTotalForum.toString(), 
            'New IG Reports': Number(totalIG) - (Number(lastMonthRecord?.reportsCompleted) || 0),
            'New Forum Reports': calcTotalForum - (Number(lastMonthRecord?.totalForumReports) || 0), 
            'Total Discord': lastMonthRecord?.totalDiscord || '0', 
            'New Discord': 0, 
            'Strike Given': '0', 
            'LOA Days': '0', 
            'loaStart': '', 
            'loaEnd': ''
          });
        }
      }
    }
    setStagedRows(processed); 
    setIsPrepModal(false);
  }

  const updateStaged = (idx, field, val) => {
    const u = [...stagedRows];
    u[idx][field] = val;
    const last = initialData.filter(r => r.name === u[idx]['Staff Name']).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    
    if (field === 'Total Discord') {
      u[idx]['New Discord'] = Number(val) - (Number(last?.totalDiscord) || 0);
    }
    if (field === 'Total Forum Reports') {
      u[idx]['New Forum Reports'] = Number(val) - (Number(last?.totalForumReports) || 0);
    }
    if (field === 'loaStart' || field === 'loaEnd') {
      if (u[idx].loaStart && u[idx].loaEnd) {
        const diff = Math.ceil((new Date(u[idx].loaEnd) - new Date(u[idx].loaStart)) / (1000 * 60 * 60 * 24)) + 1;
        u[idx]['LOA Days'] = diff > 0 ? diff.toString() : '0';
      }
    }
    setStagedRows(u);
  };

  const lookupResult = useMemo(() => {
    if (!lookupName || !lookupTotal) return null;
    const last = initialData.filter(r => r.name === lookupName).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const progress = Number(lookupTotal) - (Number(last?.reportsCompleted) || 0);
    const quota = Math.max(0, 30 - (Number(last?.loa) || 0));
    return { progress, quota, met: progress >= quota };
  }, [lookupName, lookupTotal, initialData]);

  const handleRemoveStaff = async (name) => {
    if (!window.confirm(`Confirm you want to REMOVE ${name}? This alters the roster sheet.`)) return;
    setProcessingName(name);
    const res = await manageStaffRecord({ name, action: 'Remove' });
    setProcessingName(null);
    if (res?.success) {
      setActionStatus(`❌ ${name} has been removed from the active roster.`);
      setTimeout(() => setActionStatus(null), 4000);
    }
  };

  return (
    <div className="space-y-6 relative">
      
      {actionStatus && (
        <div className="fixed bottom-6 right-6 bg-slate-800 border-2 border-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 font-bold tracking-tight animate-in slide-in-from-bottom-5">
          {actionStatus}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap gap-4 justify-between items-center shadow-xl">
        <div className="flex gap-4 items-center">
          <input type="text" placeholder="Search Staff..." className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex gap-2 items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
             <select className="bg-transparent text-[10px] font-bold outline-none" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>{availableMonths.map(m => <option key={m} value={m}>{m}</option>)}</select>
             <span className="text-[10px] text-slate-500 font-black">TO</span>
             <select className="bg-transparent text-[10px] font-bold outline-none" value={endMonth} onChange={(e) => setEndMonth(e.target.value)}>{availableMonths.map(m => <option key={m} value={m}>{m}</option>)}</select>
          </div>
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
             {['All', 'Support', 'Senior'].map(r => <button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-1 text-[10px] font-bold rounded ${roleFilter === r ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-white transition-colors'}`}>{r}</button>)}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsLookupOpen(true)} className="bg-amber-600 hover:bg-amber-500 transition-colors px-4 py-2 rounded-lg text-xs font-bold shadow-lg">Quick Look-up</button>
          <button onClick={() => setIsAddModal(true)} className="bg-indigo-600 hover:bg-indigo-500 transition-colors px-4 py-2 rounded-lg text-xs font-bold shadow-lg">Add Staff</button>
          <button onClick={() => setIsPrepModal(true)} className="bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2 rounded-lg text-xs font-bold uppercase shadow-lg">Record Monthly Stats</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="IG Leader" name={topAgents.ig?.name} val={topAgents.ig?.newIG} icon="🎮" />
        <StatCard title="Forum Leader" name={topAgents.forum?.name} val={topAgents.forum?.newForum} icon="📝" />
        <StatCard title="Discord Leader" name={topAgents.discord?.name} val={topAgents.discord?.newDiscord} icon="💬" />
      </div>

      {stagedRows.length > 0 && (
        <div className="bg-slate-900 border-2 border-emerald-500/30 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300 overflow-x-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-emerald-400 italic">STAGING AREA: Verify Data & Input LOA</h3>
            <button onClick={async () => { 
                await commitMonthlyBatch(stagedRows); 
                setStagedRows([]); 
                setActionStatus(`✅ Monthly Batch Successfully Committed!`);
                setTimeout(() => setActionStatus(null), 4000);
            }} className="bg-emerald-600 px-8 py-3 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-emerald-500 transition-colors">Finalize Commit</button>
          </div>
          <table className="w-full text-[11px] text-left">
            <thead className="bg-slate-800 text-slate-500 uppercase tracking-widest border-b border-slate-700">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2 text-center text-slate-300">New IG (Math)</th>
                <th className="p-2 text-center text-sky-400 font-bold">Total Forum (Auto)</th>
                <th className="p-2 text-center text-sky-400">New Forum</th>
                <th className="p-2 text-center text-slate-300 font-bold">Total Discord (Input)</th>
                <th className="p-2 text-center text-slate-300">New Discord</th>
                <th className="p-2 text-center text-slate-300">LOA Range (Input)</th>
                <th className="p-2 text-center text-slate-300">Days</th>
              </tr>
            </thead>
            <tbody>
              {stagedRows.map((row, idx) => {
                const queryStr = discordQueries[row['Staff Name'].toLowerCase()];
                return (
                  <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="p-2 font-bold text-white">{row['Staff Name']}</td>
                    <td className="p-2 text-center font-bold text-emerald-400">{row['New IG Reports']}</td>
                    
                    <td className="p-2 text-center">
                      <input type="number" value={row['Total Forum Reports']} className="w-12 bg-slate-950 border border-slate-700 rounded p-1 text-center text-sky-400 font-bold outline-none focus:border-sky-400" onChange={(e) => updateStaged(idx, 'Total Forum Reports', e.target.value)} />
                    </td>
                    <td className="p-2 text-center font-bold text-sky-400">{row['New Forum Reports']}</td>

                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {queryStr && (
                          <button 
                            onClick={(e) => {
                              navigator.clipboard.writeText(queryStr);
                              const el = e.currentTarget;
                              const old = el.innerText;
                              el.innerText = '✅';
                              setTimeout(() => el.innerText = old, 1500);
                            }}
                            title="Copy Discord Search Query"
                            className="text-slate-500 hover:text-emerald-400 transition-colors text-xs"
                          >
                            📋
                          </button>
                        )}
                        <input type="number" className="w-14 bg-slate-950 border border-slate-700 rounded p-1 text-center text-white outline-none focus:border-indigo-400" onChange={(e) => updateStaged(idx, 'Total Discord', e.target.value)} />
                      </div>
                    </td>
                    <td className="p-2 text-center font-bold text-slate-300">{row['New Discord']}</td>
                    
                    <td className="p-2 text-center flex gap-1 justify-center mt-1">
                      <input type="date" className="bg-slate-950 p-1 rounded text-[9px] text-white border border-slate-700 outline-none focus:border-indigo-400" onChange={(e) => updateStaged(idx, 'loaStart', e.target.value)} />
                      <input type="date" className="bg-slate-950 p-1 rounded text-[9px] text-white border border-slate-700 outline-none focus:border-indigo-400" onChange={(e) => updateStaged(idx, 'loaEnd', e.target.value)} />
                    </td>
                    <td className="p-2 text-center font-bold text-white">{row['LOA Days']}d</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-800/50 text-slate-500 uppercase text-[10px] tracking-widest border-b border-slate-800">
            <tr>
              <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('name')}>Staff Name ↕</th>
              <th className="p-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('newIG')}>New IG (Goal) ↕</th>
              <th className="p-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('newForum')}>New Forum ↕</th>
              <th className="p-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('newDiscord')}>New Discord ↕</th>
              <th className="p-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('loa')}>LOA (Selected) ↕</th>
              <th className="p-4 text-center">6-Mo Strikes</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {displayData.map((s, i) => {
              const monthsSelected = availableMonths.indexOf(startMonth) - availableMonths.indexOf(endMonth) + 1;
              const multiplier = monthsSelected > 0 ? monthsSelected : 1;
              const quota = Math.max(0, (30 * multiplier) - Number(s.loa));
              
              const career = careerStats[s.name] || { loaTotal: 0, strikes6Mo: 0, strikeDetails: [] };
              const isFailing = Number(s.newIG) < quota || (s.senior === 'TRUE' && Number(s.newForum) < (5 * multiplier));
              const hasStrike = Number(s.strike) > 0;
              const isWaived = waivedStrikes.includes(`${s.name}-${endMonth}`);
              const isProcessing = processingName === s.name;

              return (
                <tr key={i} className={`hover:bg-slate-800/30 transition-colors ${isFailing && !hasStrike && !isWaived ? 'bg-rose-500/10' : ''} ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <td className="p-4 font-bold text-white">
                    {s.name}
                    <div className="text-[10px] text-slate-500 uppercase">{s.senior === 'TRUE' ? 'Senior' : 'Support'}</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col"><span className={`text-lg font-bold ${Number(s.newIG) >= quota ? 'text-white' : 'text-rose-400'}`}>{s.newIG}</span><span className="text-[10px] text-slate-500 font-black">GOAL: {quota}</span></div>
                  </td>
                  <td className="p-4 text-center font-bold text-white text-lg">{s.senior === 'TRUE' ? s.newForum : '-'}</td>
                  <td className="p-4 text-center font-bold text-slate-300 text-lg">{s.newDiscord}</td>
                  <td className="p-4 text-center relative group">
                    <span className="text-white font-bold underline decoration-dotted cursor-help text-lg">{s.loa || 0}d</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 w-32 p-2 bg-slate-950 border border-slate-700 rounded text-[10px] text-center shadow-xl">Career Total: {career.loaTotal}d</div>
                  </td>
                  <td className="p-4 text-center relative group">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto border font-bold ${career.strikes6Mo > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>{career.strikes6Mo}</div>
                    {career.strikes6Mo > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 w-48 p-3 bg-slate-950 border border-slate-700 rounded shadow-2xl text-[10px] text-left">
                        <div className="font-bold text-rose-400 mb-1 tracking-tighter uppercase">Strike History (6-Mo)</div>
                        {career.strikeDetails.map((d, idx) => <div key={idx} className="text-slate-300">• {d}</div>)}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {isFailing && !hasStrike && !isWaived ? (
                      <div className="flex items-center justify-center gap-1">
                         <span className="text-[9px] font-black text-rose-500 uppercase animate-pulse mr-2 tracking-widest">DUE</span>
                         <button onClick={async () => { 
                            if(confirm(`Confirm Strike for ${s.name}?`)) {
                              setProcessingName(s.name);
                              await issueStrike({name: s.name, date: endMonth + "-01", amount: '1'}); 
                              setProcessingName(null);
                              setActionStatus(`⚠️ Strike issued to ${s.name}`);
                              setTimeout(() => setActionStatus(null), 4000);
                            }
                         }} className="bg-rose-600 hover:bg-rose-500 text-[9px] px-2 py-1.5 rounded text-white font-bold uppercase transition-colors">{isProcessing ? '...' : 'Confirm'}</button>
                         <button onClick={() => setWaivedStrikes([...waivedStrikes, `${s.name}-${endMonth}`])} className="bg-slate-700 hover:bg-slate-600 text-[9px] px-2 py-1.5 rounded text-white font-bold uppercase transition-colors">Deny</button>
                      </div>
                    ) : (
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setRankModal({ isOpen: true, name: s.name, role: s.senior === 'TRUE' ? 'Senior' : 'Support' })} className="text-[10px] font-bold text-indigo-400 hover:text-white uppercase underline transition-colors">{isProcessing ? 'Wait' : 'Rank'}</button>
                        <button onClick={() => handleRemoveStaff(s.name)} className="text-[10px] font-bold text-rose-400 hover:text-white uppercase underline transition-colors">{isProcessing ? 'Wait' : 'Remove'}</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* QUICK LOOKUP MODAL */}
      {isLookupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-2 uppercase italic text-center">Progress Check</h3>
            <div className="space-y-4">
              <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500" value={lookupName} onChange={(e) => setLookupName(e.target.value)}>
                <option value="">Select Staff...</option>
                {[...new Set(initialData.map(s => s.name))].sort().map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input type="number" placeholder="Enter Current Total IG" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500" value={lookupTotal} onChange={(e) => setLookupTotal(e.target.value)} />
            </div>
            {lookupResult && (
              <div className="mt-8 p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center shadow-inner">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Month-to-Date Progress</div>
                <div className={`text-6xl font-black ${lookupResult.met ? 'text-white' : 'text-rose-400'}`}>{lookupResult.progress}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Current Quota: {lookupResult.quota}</div>
              </div>
            )}
            <button onClick={() => { setIsLookupOpen(false); setLookupName(""); setLookupTotal(""); }} className="w-full mt-6 py-4 bg-slate-800 hover:bg-slate-700 transition-colors rounded-xl font-bold text-slate-400 uppercase text-xs">Close Window</button>
          </div>
        </div>
      )}

      {/* UPDATE RANK MODAL */}
      {rankModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 italic uppercase tracking-tight">Update Rank for {rankModal.name}</h3>
            <select className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 mb-6 text-white outline-none focus:border-indigo-500" value={rankModal.role} onChange={(e) => setRankModal({...rankModal, role: e.target.value})}>
                <option value="Support">Support</option>
                <option value="Senior">Senior Support</option>
            </select>
            <div className="flex gap-4">
              <button onClick={() => setRankModal({isOpen: false, name: "", role: "Support"})} className="flex-1 text-slate-400 font-bold uppercase text-xs">Cancel</button>
              <button disabled={processingName === rankModal.name} onClick={async () => {
                setProcessingName(rankModal.name);
                const res = await manageStaffRecord({ name: rankModal.name, action: 'UpdateRank', role: rankModal.role });
                setProcessingName(null);
                setRankModal({isOpen: false, name: "", role: "Support"});
                if(res?.success) {
                  setActionStatus(`✅ ${rankModal.name} rank updated!`);
                  setTimeout(() => setActionStatus(null), 4000);
                }
              }} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-xl font-bold text-white uppercase text-xs shadow-lg">{processingName === rankModal.name ? 'Updating...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {isAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 italic uppercase tracking-tight">Add Staff</h3>
            <input type="text" className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 mb-4 text-white outline-none focus:border-indigo-500" placeholder="Full Name" onChange={(e) => setFormState({...formState, name: e.target.value})} />
            <input type="text" className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 mb-4 text-white outline-none focus:border-indigo-500" placeholder="Discord Username (e.g. johndoe)" onChange={(e) => setFormState({...formState, discord: e.target.value})} />
            <select className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 mb-6 text-white outline-none focus:border-indigo-500" onChange={(e) => setFormState({...formState, role: e.target.value})}>
                <option value="Support">Support</option>
                <option value="Senior">Senior Support</option>
            </select>
            <div className="flex gap-4">
              <button onClick={() => setIsAddModal(false)} className="flex-1 text-slate-400 font-bold uppercase text-xs">Cancel</button>
              <button disabled={processingName === 'adding'} onClick={async () => { 
                setProcessingName('adding');
                const res = await manageStaffRecord({...formState, action: 'Add'}); 
                setProcessingName(null);
                setIsAddModal(false); 
                if(res?.success) {
                  setActionStatus(`✅ ${formState.name} has been added!`);
                  setTimeout(() => setActionStatus(null), 4000);
                }
              }} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-xl font-bold text-white uppercase text-xs shadow-lg">{processingName === 'adding' ? 'Adding...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PREP MODAL */}
      {isPrepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-3xl shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-6 uppercase italic tracking-tighter">Record Monthly Stats</h3>
            <div className="mb-6 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                  Select Target Month (Displays locally as MM/DD/YYYY, writes to sheet as YYYY-MM)
                </label>
                <input type="date" className="w-full bg-transparent text-indigo-400 outline-none font-bold" value={prepDate} onChange={(e) => setPrepDate(e.target.value)} />
            </div>
            <textarea className="w-full h-72 p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 outline-none focus:border-indigo-500 transition-colors" placeholder="Paste flat panel data here..." value={prepText} onChange={(e) => setPrepText(e.target.value)} />
            <div className="flex gap-4 mt-8">
              <button onClick={() => setIsPrepModal(false)} className="flex-1 py-4 text-slate-500 font-bold uppercase text-xs hover:text-white transition-colors">Cancel</button>
              <button onClick={handleProcessPrep} className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-2xl font-bold text-white uppercase text-xs shadow-lg">Process Shredder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, name, val, icon }) {
  if (!name) return null;
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 border-l-4 border-l-indigo-500 shadow-lg transition-transform hover:scale-[1.02]">
      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-lg">{icon}</div>
      <div>
        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{title}</div>
        <div className="text-lg font-black text-white">{name}</div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{val} Reports</div>
      </div>
    </div>
  );
}
