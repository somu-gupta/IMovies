const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/User');
const Movie = require('../src/models/Movie');
const Cinema = require('../src/models/Cinema');
const Show = require('../src/models/Show');

const movies = [
  ['The Last Orbit', 'the-last-orbit', 'Sci-Fi', 'English', 142, 8.7, 'U/A 13+', 'On the edge of a dying star system, one pilot carries humanity’s last chance home.', 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=780&q=85'],
  ['Blue Hour', 'blue-hour', 'Drama', 'Hindi', 128, 8.2, 'U/A 13+', 'Two strangers find their way back to the people they love during one unexpected night in the city.', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=780&q=85'],
  ['Wildwood', 'wildwood', 'Adventure', 'English', 116, 7.9, 'U', 'A young cartographer enters an ancient forest where every trail remembers those who walked it before.', 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=780&q=85'],
  ['The Art of Us', 'the-art-of-us', 'Romance', 'Tamil', 134, 8.4, 'U/A 16+', 'A restless painter and a meticulous restorer discover that some things are more beautiful unfinished.', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=780&q=85'],
  ['Redline', 'redline', 'Action', 'English', 109, 7.6, 'A', 'One final race. One impossible city. A driver with nothing left to lose.', 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=780&q=85'],
  ['Monsoon Notes', 'monsoon-notes', 'Drama', 'Malayalam', 121, 8.1, 'U', 'A daughter returns to the coast and finds letters that change everything she knew about home.', 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=780&q=85'],
  ['Little Giants', 'little-giants', 'Family', 'Hindi', 98, 7.8, 'U', 'A spirited neighbourhood team gets one summer to prove the smallest players can dream biggest.', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=780&q=85'],
  ['Afterimage', 'afterimage', 'Thriller', 'Telugu', 132, 8.0, 'U/A 16+', 'A crime photographer sees details in her images that were never there when she took them.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=780&q=85'],
];

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seeding is disabled in production');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding');
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters');
  await connectDatabase();
  const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const existingAdmin = await User.findOne({ email: adminEmail }).select('_id');
  if (!existingAdmin) await User.create({ name: process.env.ADMIN_NAME || 'IMovies Admin', email: adminEmail, password: process.env.ADMIN_PASSWORD, role: 'admin' });

  const movieDocs = [];
  for (const [title, slug, genre, language, duration, rating, certificate, description, posterUrl] of movies) {
    movieDocs.push(await Movie.findOneAndUpdate({ slug }, { $setOnInsert: { title, description, genre, language, duration, rating, certificate, posterUrl, isActive: true } }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }));
  }
  const cinemaInfo = [
    { name: 'IMovies Downtown', city: 'Bengaluru', address: '12 Theatre Road, Central District', screens: [{ name: 'Screen 1', capacity: 60 }, { name: 'Screen 2', capacity: 60 }] },
    { name: 'IMovies Lakeside', city: 'Bengaluru', address: '8 Lakeview Avenue, North Quarter', screens: [{ name: 'Screen 1', capacity: 60 }, { name: 'Screen 2', capacity: 60 }] },
  ];
  const cinemas = [];
  for (const item of cinemaInfo) cinemas.push(await Cinema.findOneAndUpdate({ name: item.name, city: item.city }, { $setOnInsert: { ...item, isActive: true } }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }));

  const times = [[10, 30], [13, 45], [17, 15], [20, 40]];
  let showCount = 0;
  for (let day = 0; day < 7; day += 1) {
    for (let cinemaIndex = 0; cinemaIndex < cinemas.length; cinemaIndex += 1) {
      for (let slot = 0; slot < times.length; slot += 1) {
        const startsAt = new Date(); startsAt.setDate(startsAt.getDate() + day); startsAt.setHours(times[slot][0], times[slot][1], 0, 0);
        if (startsAt <= new Date()) continue;
        const movie = movieDocs[(day * 2 + cinemaIndex * 3 + slot) % movieDocs.length];
        const screen = slot % 2 ? 'Screen 2' : 'Screen 1';
        const endsAt = new Date(startsAt.getTime() + (movie.duration + 25) * 60000);
        await Show.findOneAndUpdate({ cinema: cinemas[cinemaIndex]._id, screen, startsAt }, { $setOnInsert: { movie: movie._id, cinema: cinemas[cinemaIndex]._id, screen, startsAt, endsAt, ticketPrice: cinemaIndex ? 220 : 180, capacity: 60, bookedSeats: [], isActive: true } }, { upsert: true, returnDocument: 'after' });
        showCount += 1;
      }
    }
  }
  console.log(`Seed complete: ${movieDocs.length} sample movies, ${cinemas.length} sample cinemas, ${showCount} scheduled show slots checked; existing records were preserved.`);
}

seed().catch((error) => { console.error(`Seed failed: ${error.message}`); process.exitCode = 1; }).finally(() => mongoose.disconnect());
