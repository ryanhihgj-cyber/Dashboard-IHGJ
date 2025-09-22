const express = require('express');
const bodyParser = require('body-parser');
const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/slack/actions', async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload);
    const actionId = payload.actions?.[0]?.action_id;
    const user = payload.user?.username || 'unknown';

    if (!actionId || !actionId.includes('_')) {
      console.error('Invalid or missing action_id:', actionId);
      return res.status(400).json({ text: '⚠️ Invalid action ID', replace_original: true });
    }

    const rowStr = actionId.split('_').pop();
    const row = parseInt(rowStr, 10);

    if (isNaN(row) || row <= 0) {
      console.error('Invalid row number parsed from action_id:', rowStr);
      return res.status(400).json({ text: '⚠️ Invalid row number', replace_original: true });
    }

    const rowIndex = row - 1;
    console.log(`Received actionId: ${actionId}, parsed row index: ${rowIndex}`);

    const doc = new GoogleSpreadsheet(process.env.SHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Jobs List'];
    const rows = await sheet.getRows();

    if (rowIndex < 0 || rowIndex >= rows.length) {
      console.error(`Row index ${rowIndex} is out of bounds. Total rows: ${rows.length}`);
      return res.status(400).json({ text: `⚠️ Row index ${rowIndex} is out of bounds`, replace_original: true });
    }

    const targetRow = rows[rowIndex];

    if (actionId.startsWith('mark_complete_')) {
      targetRow['Marked Complete'] = 'TRUE';
      targetRow['Percent Complete'] = 100;
      await targetRow.save();
      return res.json({ text: `✅ Job marked complete by @${user}`, replace_original: true });
    } else if (actionId.startsWith('resolve_job_')) {
      targetRow['Marked Complete'] = 'TRUE';
      targetRow['Percent Complete'] = 100;
      await targetRow.save();
      return res.json({ text: `❗ Job resolved by @${user}`, replace_original: true });
    } else {
      return res.json({ text: `Action ${actionId} clicked by @${user}`, replace_original: true });
    }
  } catch (error) {
    console.error('Error handling Slack action:', error);
    return res.status(500).json({ text: '⚠️ Internal server error', replace_original: true });
  }
});

app.get('/', (req, res) => res.send('Slack interactivity server is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
