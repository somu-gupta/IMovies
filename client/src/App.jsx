import { Route, Routes } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout.jsx';
import { HomePage, MoviesPage, MoviePage, AuthPage, BookingsPage, SeatPage, ConfirmationPage, AdminPage, NotFoundPage } from './pages/Pages.jsx';
import './admin.css';
import './responsive.css';

export default function App() {
  return <SiteLayout><Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/movies" element={<MoviesPage/>}/>
    <Route path="/movie/:id" element={<MoviePage/>}/>
    <Route path="/login" element={<AuthPage/>}/>
    <Route path="/register" element={<AuthPage register/>}/>
    <Route path="/bookings" element={<BookingsPage/>}/>
    <Route path="/admin" element={<AdminPage/>}/>
    <Route path="/seats/:id" element={<SeatPage/>}/>
    <Route path="/confirmation/:id" element={<ConfirmationPage/>}/>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes></SiteLayout>;
}
