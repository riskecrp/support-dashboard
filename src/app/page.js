import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import StaffTable from './StaffTable';

export default async function Home() {
  let staffData = [];
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; 
    const rows = await sheet.getRows();

    staffData = rows.map((row) => ({
      date: row.get('Date') || '',
      name: row.get('Staff Name') || 'Unknown',
      senior: String(row.get('Senior')).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',
      // The "New" stats for History math
      newIG: row.get('New IG Reports') || '0',
      newForum: row.get('New Forum Reports') || '0',
      newDiscord: row.get('New Discord') || '0',
      // The "Total" stats for Snapshot cumulative view
      reportsCompleted: row.get('Total Reports Completed') || '0',
      totalForumReports: row.get('Total Forum Reports') || '0',
      totalDiscord: row.get('Total Discord') || '0',
      // Admin stats
      strike: row.get('Strike Given') || '0',
      loa: row.get('LOA Days') || '0'
    }));
  } catch (e) {
    console.error("Fetch Error:", e);
  }

  return (
    <main className="min-h-screen p-8 bg-slate-950 text-white">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-4xl font-black mb-10 tracking-tighter bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent italic">COMMAND CENTER</h1>
        <StaffTable initialData={staffData} />
      </div>
    </main>
  );
}