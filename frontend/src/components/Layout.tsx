import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconClipboard, IconHome, IconLogout, IconUser, IconUsers } from './Icons';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: <IconHome /> },
  { to: '/children', label: 'Crianças', icon: <IconUsers /> },
  { to: '/applications/new', label: 'Nova aplicação', icon: <IconClipboard /> },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isApplication = /^\/applications\/[^/]+\/run$/.test(location.pathname);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className={`layout${isApplication ? ' layout-application' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <div>
            <strong>PAPL</strong>
            <span className="brand-sub">Avaliação de leitura</span>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/profile" className="nav-link" title="Perfil">
            <span className="nav-icon" aria-hidden="true">
              <IconUser />
            </span>
            {user?.name ?? 'Perfil'}
          </NavLink>
          <button type="button" className="nav-link nav-link-button" title="Sair" onClick={handleLogout}>
            <span className="nav-icon" aria-hidden="true">
              <IconLogout />
            </span>
            Sair
          </button>
        </div>
      </aside>
      <main className="content" id="main-content">
        {children}
      </main>
    </div>
  );
}