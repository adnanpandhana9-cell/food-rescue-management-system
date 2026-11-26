import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Sprout,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function Navbar() {
  const { user, unreadCount, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const dashboardPath =
    user?.role === 'provider'
      ? '/provider/dashboard'
      : user?.role === 'seeker'
        ? '/seeker/dashboard'
        : '/admin/dashboard';

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`navbar ${menuOpen ? 'open' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-badge">
            <Sprout size={20} />
          </span>
          <span>FRMS Rescue</span>
        </Link>

        <button
          type="button"
          className="mobile-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle navigation menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className="nav-links" aria-label="Primary navigation">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
            <Home size={16} /> Home
          </NavLink>
          <NavLink to="/foods" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
            <Search size={16} /> Food Listings
          </NavLink>

          {user && (
            <>
              <NavLink
                to={dashboardPath}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMenu}
              >
                <LayoutDashboard size={16} /> Dashboard
              </NavLink>
              <NavLink
                to="/requests"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMenu}
              >
                <ClipboardList size={16} /> Requests & Distribution
              </NavLink>
              <NavLink
                to="/profile"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMenu}
              >
                <User size={16} /> Profile
              </NavLink>
            </>
          )}
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/notifications" className="notif-btn" aria-label="Notifications" onClick={closeMenu}>
                <Bell size={18} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </Link>
              <span className="badge badge-role" style={{ textTransform: 'capitalize' }}>
                {user.role}: {user.username}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
                <LogOut size={15} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary btn-sm" onClick={closeMenu}>
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={closeMenu}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
