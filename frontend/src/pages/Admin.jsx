import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TABS = [
  { id: 'users', label: 'Utilizadores', icon: '👥' },
  { id: 'upload', label: 'Upload Dados', icon: '📤' },
  { id: 'clients', label: 'Atribuir Clientes', icon: '🔗' },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div>
      <h2 style={styles.pageTitle}>Administração</h2>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'upload' && <UploadTab />}
      {activeTab === 'clients' && <ClientsTab />}
    </div>
  );
}

// ==================== USERS TAB ====================
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'user' });
  const [tempPassword, setTempPassword] = useState('');
  const [error, setError] = useState('');
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Erro ao carregar utilizadores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setTempPassword('');
    try {
      const res = await api.post('/admin/users', formData);
      setTempPassword(res.data.temp_password);
      setFormData({ name: '', email: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar utilizador');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Tens a certeza que queres remover ${name}?`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover');
    }
  };

  const handleResetPassword = async (id, name) => {
    if (!window.confirm(`Resetar password de ${name}?`)) return;
    try {
      const res = await api.post(`/admin/users/${id}/reset-password`);
      alert(`Nova password temporária de ${name}: ${res.data.temp_password}`);
    } catch (err) {
      alert('Erro ao resetar password');
    }
  };

  const toggleComissoes = async (id, current) => {
    try {
      await api.put(`/admin/users/${id}`, { can_view_comissoes: !current });
      fetchUsers();
    } catch (err) {
      alert('Erro ao alterar permissão');
    }
  };

  if (loading) return <p style={styles.loading}>A carregar...</p>;

  return (
    <div>
      {/* Botão criar */}
      <div style={styles.sectionHeader}>
        <span style={styles.sectionCount}>{users.length} utilizadores</span>
        <button onClick={() => { setShowForm(!showForm); setTempPassword(''); setError(''); }} style={styles.addBtn}>
          {showForm ? 'Cancelar' : '+ Novo Utilizador'}
        </button>
      </div>

      {/* Form criar */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Novo Utilizador</h3>
          <form onSubmit={handleCreate} style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Nome</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={styles.input}
                placeholder="Nome completo"
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                style={styles.input}
                placeholder="email@empresa.pt"
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Perfil</label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                style={styles.input}
              >
                <option value="user">Utilizador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" style={styles.submitBtn}>Criar</button>
            </div>
          </form>
          {error && <div style={styles.error}>{error}</div>}
          {tempPassword && (
            <div style={styles.success}>
              ✅ Utilizador criado! Password temporária: <strong>{tempPassword}</strong>
              <br /><small>O utilizador terá de mudar a password no primeiro login.</small>
            </div>
          )}
        </div>
      )}

      {/* Lista de utilizadores */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Nome</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Perfil</th>
              <th style={styles.th}>Comissões</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Acções</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={styles.tr}>
                <td style={styles.td}>
                  <span style={styles.userName}>{u.name}</span>
                </td>
                <td style={styles.td}>
                  <span style={styles.userEmail}>{u.email}</span>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    background: u.role === 'admin' ? '#f0f4ff' : '#f0fdf4',
                    color: u.role === 'admin' ? '#667eea' : '#16a34a',
                  }}>
                    {u.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </td>
                <td style={styles.td}>
                  <button
                    onClick={() => toggleComissoes(u.id, u.can_view_comissoes)}
                    style={{
                      ...styles.toggleBtn,
                      background: u.can_view_comissoes ? '#667eea' : '#e5e7eb',
                    }}
                  >
                    <span style={{
                      ...styles.toggleDot,
                      transform: u.can_view_comissoes ? 'translateX(16px)' : 'translateX(0)',
                    }} />
                  </button>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    background: u.temp_password ? '#fef3c7' : '#f0fdf4',
                    color: u.temp_password ? '#d97706' : '#16a34a',
                  }}>
                    {u.temp_password ? 'Pendente' : 'Activo'}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={styles.actions}>
                    <button
                      onClick={() => handleResetPassword(u.id, u.name)}
                      style={styles.actionBtn}
                      title="Resetar password"
                    >🔑</button>
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        style={{ ...styles.actionBtn, color: '#ef4444' }}
                        title="Remover"
                      >🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== UPLOAD TAB ====================
function UploadTab() {
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fetchUploads = async () => {
    try {
      const res = await api.get('/upload');
      setUploads(res.data);
    } catch (err) {
      console.error('Erro ao carregar uploads:', err);
    }
  };

  useEffect(() => { fetchUploads(); }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
      fetchUploads();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar ficheiro');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    handleUpload(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleUpload(file);
  };

  const handleDeleteUpload = async (id) => {
    if (!window.confirm('Remover este upload e todos os dados associados?')) return;
    try {
      await api.delete(`/upload/${id}`);
      fetchUploads();
    } catch (err) {
      alert('Erro ao remover upload');
    }
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        style={{
          ...styles.dropZone,
          borderColor: dragOver ? '#667eea' : '#d1d5db',
          background: dragOver ? '#f0f4ff' : '#fafafa',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div style={styles.dropContent}>
            <span style={{ fontSize: '32px' }}>⏳</span>
            <p style={styles.dropText}>A processar ficheiro...</p>
          </div>
        ) : (
          <div style={styles.dropContent}>
            <span style={{ fontSize: '32px' }}>📁</span>
            <p style={styles.dropText}>Arrasta um ficheiro Excel ou CSV aqui</p>
            <p style={styles.dropSubtext}>ou</p>
            <label style={styles.fileBtn}>
              Escolher ficheiro
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />
            </label>
          </div>
        )}
      </div>

      {error && <div style={{ ...styles.error, marginTop: '16px' }}>{error}</div>}
      
      {result && (
        <div style={{ ...styles.success, marginTop: '16px' }}>
          ✅ <strong>{result.records}</strong> registos importados do ficheiro.
          Período: {result.period}. Ano: {result.year}.
        </div>
      )}

      {/* Histórico de uploads */}
      {uploads.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={styles.formTitle}>Histórico de Uploads</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Ficheiro</th>
                  <th style={styles.th}>Ano</th>
                  <th style={styles.th}>Período</th>
                  <th style={styles.th}>Registos</th>
                  <th style={styles.th}>Data Upload</th>
                  <th style={styles.th}>Acções</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map(u => (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}><span style={styles.userName}>{u.filename}</span></td>
                    <td style={styles.td}>{u.year}</td>
                    <td style={styles.td}><span style={styles.userEmail}>{u.period_start} → {u.period_end}</span></td>
                    <td style={styles.td}>{u.record_count?.toLocaleString()}</td>
                    <td style={styles.td}>
                      <span style={styles.userEmail}>
                        {new Date(u.uploaded_at).toLocaleDateString('pt-PT')} {new Date(u.uploaded_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => handleDeleteUpload(u.id)}
                        style={{ ...styles.actionBtn, color: '#ef4444' }}
                        title="Remover upload e dados"
                      >🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== CLIENTS TAB ====================
function ClientsTab() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [allClients, setAllClients] = useState([]);
  const [userClients, setUserClients] = useState([]);
  const [isAllClients, setIsAllClients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, clientsRes] = await Promise.all([
          api.get('/admin/users'),
          api.get('/vendas/by-client?year=' + new Date().getFullYear())
        ]);
        setUsers(usersRes.data.filter(u => u.role !== 'admin'));
        setAllClients(clientsRes.data.map(c => c.client));
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      }
    };
    fetchData();
  }, []);

  const selectUser = async (user) => {
    setSelectedUser(user);
    setMessage('');
    try {
      const res = await api.get(`/admin/users/${user.id}/clients`);
      const hasAll = res.data.some(c => c.all_clients);
      setIsAllClients(hasAll);
      setUserClients(hasAll ? [] : res.data.map(c => c.client_name));
    } catch (err) {
      console.error('Erro ao carregar clientes do utilizador:', err);
    }
  };

  const toggleClient = (client) => {
    setUserClients(prev =>
      prev.includes(client) ? prev.filter(c => c !== client) : [...prev, client]
    );
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setMessage('');
    try {
      await api.post(`/admin/users/${selectedUser.id}/clients`, {
        all_clients: isAllClients,
        clients: isAllClients ? [] : userClients,
      });
      setMessage('✅ Clientes atribuídos com sucesso');
    } catch (err) {
      setMessage('❌ Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.clientsLayout}>
      {/* Lista de utilizadores */}
      <div style={styles.clientsUserList}>
        <h3 style={styles.formTitle}>Utilizadores</h3>
        {users.length === 0 ? (
          <p style={styles.emptyText}>Nenhum utilizador criado (além do admin)</p>
        ) : (
          users.map(u => (
            <button
              key={u.id}
              onClick={() => selectUser(u)}
              style={{
                ...styles.userCard,
                borderColor: selectedUser?.id === u.id ? '#667eea' : '#e5e7eb',
                background: selectedUser?.id === u.id ? '#f0f4ff' : 'white',
              }}
            >
              <span style={styles.userCardName}>{u.name}</span>
              <span style={styles.userCardEmail}>{u.email}</span>
            </button>
          ))
        )}
      </div>

      {/* Atribuição de clientes */}
      <div style={styles.clientsAssignment}>
        {selectedUser ? (
          <>
            <div style={styles.clientsHeader}>
              <h3 style={styles.formTitle}>Clientes de {selectedUser.name}</h3>
              <button onClick={handleSave} style={styles.submitBtn} disabled={saving}>
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>

            {message && (
              <div style={{
                ...message.includes('✅') ? styles.success : styles.error,
                marginBottom: '16px'
              }}>{message}</div>
            )}

            {/* Toggle todos os clientes */}
            <div style={styles.allClientsToggle}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isAllClients}
                  onChange={e => { setIsAllClients(e.target.checked); setUserClients([]); }}
                  style={styles.checkbox}
                />
                <span>Acesso a todos os clientes</span>
              </label>
            </div>

            {/* Lista de clientes individuais */}
            {!isAllClients && (
              <div style={styles.clientsList}>
                {allClients.length === 0 ? (
                  <p style={styles.emptyText}>Nenhum cliente disponível. Faz upload dos dados primeiro.</p>
                ) : (
                  allClients.map(client => (
                    <label key={client} style={styles.clientItem}>
                      <input
                        type="checkbox"
                        checked={userClients.includes(client)}
                        onChange={() => toggleClient(client)}
                        style={styles.checkbox}
                      />
                      <span style={styles.clientName}>{client}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <div style={styles.emptyState}>
            <span style={{ fontSize: '40px' }}>👈</span>
            <p style={styles.emptyText}>Selecciona um utilizador para atribuir clientes</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== STYLES ====================
const styles = {
  pageTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '24px',
    letterSpacing: '-0.3px',
  },

  // Tabs
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '28px',
    background: '#f3f4f6',
    borderRadius: '10px',
    padding: '4px',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    border: 'none',
    background: 'transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: '#6b7280',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'white',
    color: '#111827',
    fontWeight: '600',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },

  // Section header
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  sectionCount: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  addBtn: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // Form
  formCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
  },
  formTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '16px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 140px auto',
    gap: '16px',
    alignItems: 'end',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    background: '#fafafa',
  },
  submitBtn: {
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },

  // Table
  tableWrapper: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: '#fafafa',
    borderBottom: '1px solid #f3f4f6',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '14px 16px',
    fontSize: '13px',
  },
  userName: {
    fontWeight: '500',
    color: '#111827',
  },
  userEmail: {
    color: '#6b7280',
    fontSize: '12px',
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
  },
  actions: {
    display: 'flex',
    gap: '4px',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 6px',
    borderRadius: '4px',
  },

  // Toggle
  toggleBtn: {
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
    padding: 0,
  },
  toggleDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: 'white',
    position: 'absolute',
    top: '2px',
    left: '2px',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
  },

  // Upload
  dropZone: {
    border: '2px dashed #d1d5db',
    borderRadius: '12px',
    padding: '48px 24px',
    textAlign: 'center',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  dropContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  dropText: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
    margin: 0,
  },
  dropSubtext: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: 0,
  },
  fileBtn: {
    padding: '10px 24px',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    color: '#374151',
    marginTop: '4px',
  },

  // Clients
  clientsLayout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '24px',
  },
  clientsUserList: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
  },
  userCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: 'white',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '8px',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  userCardName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#111827',
  },
  userCardEmail: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  clientsAssignment: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
  },
  clientsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  allClientsToggle: {
    padding: '14px 16px',
    background: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#667eea',
    cursor: 'pointer',
  },
  clientsList: {
    maxHeight: '400px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  clientItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'background 0.1s',
  },
  clientName: {
    color: '#374151',
  },

  // States
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    gap: '12px',
  },
  emptyText: {
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center',
  },
  loading: {
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center',
    padding: '40px',
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13px',
    marginTop: '12px',
  },
  success: {
    background: '#f0fdf4',
    color: '#16a34a',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13px',
    marginTop: '12px',
    lineHeight: '1.5',
  },
};