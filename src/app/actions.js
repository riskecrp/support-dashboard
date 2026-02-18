"use server";
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { revalidatePath } from 'next/cache';

async function getDocument() {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

export async function manageStaffRecord({ name, action, role, discord }) {
  const doc = await getDocument();
  const rosterTab = doc.sheetsById[0];
  const changelogTab = doc.sheetsById[1704969768];
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  let isSupport = action === 'Remove' ? 'FALSE' : 'TRUE';
  let isSenior = action === 'Promote' || action === 'UpdateRank' ? (role === 'Senior' ? 'TRUE' : 'FALSE') : (action === 'Demote' ? 'FALSE' : (role === 'Senior' ? 'TRUE' : 'FALSE'));
  
  const rows = await rosterTab.getRows();
  const row = rows.find(r => r.get('Name')?.toLowerCase().trim() === name.toLowerCase().trim());
  
  if (row) {
    row.set('Support', isSupport); 
    row.set('SeniorSupport', isSenior);
    await row.save();
  } else if (action === 'Add') {
    await rosterTab.addRow({ 
      'Name': name, 
      'Support': isSupport, 
      'SeniorSupport': isSenior,
      'Discord Query': discord ? `in: ticket-transcripts ${discord}` : '' 
    });
  }
  
  await changelogTab.addRow({ 'Timestamp': timestamp, 'Staff': name, 'Action': action, 'Support': isSupport, 'Senior Support': isSenior });
  revalidatePath('/');
  return { success: true };
}

export async function commitMonthlyBatch(stagedRows) {
  const doc = await getDocument();
  const allStatsTab = doc.sheetsByIndex[0];
  await allStatsTab.addRows(stagedRows);
  revalidatePath('/');
  return { success: true };
}

export async function issueStrike({ name, date, amount }) {
  const doc = await getDocument();
  const allStatsTab = doc.sheetsByIndex[0];
  const rows = await allStatsTab.getRows();
  const row = rows.find(r => r.get('Staff Name') === name && r.get('Date') === date);
  if (row) {
    row.set('Strike Given', amount);
    await row.save();
    revalidatePath('/');
    return { success: true };
  }
  return { success: false };
}

// NEW: Fetches the Discord queries for the 1-Click Copy button
export async function getDiscordQueries() {
  const doc = await getDocument();
  const rosterTab = doc.sheetsById[0];
  const rows = await rosterTab.getRows();
  const queries = {};
  
  for (const r of rows) {
    const name = r.get('Name');
    const query = r.get('Discord Query');
    if (name && query) {
      queries[name.trim().toLowerCase()] = query;
    }
  }
  return queries;
}
