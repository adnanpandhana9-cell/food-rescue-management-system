import { initDatabase, seedDatabase } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 3000);
const db = initDatabase();
seedDatabase(db);

const app = createApp(db);

app.listen(PORT, () => {
  console.log(`Food Rescue Management System running at http://localhost:${PORT}`);
});
