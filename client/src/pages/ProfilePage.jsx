import React, { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export function ProfilePage() {
  const { user, updateUserState } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    organization: user?.organization || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    try {
      const res = await api.updateProfile(form);
      updateUserState(res.user);
      setProfileMsg('Profile updated successfully.');
    } catch (err) {
      setProfileErr(err.message);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPwMsg('');
    setPwErr('');
    try {
      await api.changePassword(pwForm);
      setPwForm({ currentPassword: '', newPassword: '' });
      setPwMsg('Password changed successfully.');
    } catch (err) {
      setPwErr(err.message);
    }
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '860px' }}>
        <div className="page-header">
          <div>
            <h1>User Profile</h1>
            <p>
              Account Role: <strong style={{ textTransform: 'capitalize' }}>{user?.role}</strong>
            </p>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>Account Details</h2>
            {profileMsg && <div className="alert alert-success">{profileMsg}</div>}
            {profileErr && <div className="alert alert-error">{profileErr}</div>}

            <form onSubmit={handleProfileSave}>
              <div className="form-group">
                <label className="form-label" htmlFor="prof_name">Full Name</label>
                <input
                  id="prof_name"
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof_user">Username</label>
                <input
                  id="prof_user"
                  className="form-control"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof_email">Email</label>
                <input
                  id="prof_email"
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof_org">Organization</label>
                <input
                  id="prof_org"
                  className="form-control"
                  value={form.organization}
                  onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof_phone">Phone</label>
                <input
                  id="prof_phone"
                  className="form-control"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof_addr">Address</label>
                <input
                  id="prof_addr"
                  className="form-control"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                <Save size={16} /> Save Profile
              </button>
            </form>
          </div>

          <div className="card" style={{ alignSelf: 'start' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>Change Password</h2>
            {pwMsg && <div className="alert alert-success">{pwMsg}</div>}
            {pwErr && <div className="alert alert-error">{pwErr}</div>}

            <form onSubmit={handlePasswordSave}>
              <div className="form-group">
                <label className="form-label" htmlFor="cur_pw">Current Password</label>
                <input
                  id="cur_pw"
                  type="password"
                  className="form-control"
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="new_pw">New Password (min 6 chars)</label>
                <input
                  id="new_pw"
                  type="password"
                  minLength={6}
                  className="form-control"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" className="btn btn-secondary">
                <KeyRound size={16} /> Update Password
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
