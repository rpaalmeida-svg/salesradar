import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';

// ============================================
// COMPONENTE: Árvore Organizacional de Contactos
// ============================================

// ─── Construir árvore a partir de lista plana ───
function buildTree(contacts) {
  const map = {};
  const roots = [];
  contacts.forEach(c => {
    map[c.id] = { ...c, children: [] };
  });
  contacts.forEach(c => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].children.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });
  const sortChildren = (nodes) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);
  return roots;
}

// ─── Obter descendentes (para evitar referências circulares) ───
function getDescendantIds(contacts, parentId) {
  const ids = new Set();
  const findChildren = (pid) => {
    contacts.forEach(c => {
      if (c.parent_id === pid) {
        ids.add(c.id);
        findChildren(c.id);
      }
    });
  };
  findChildren(parentId);
  return ids;
}

// ─── Gerar opções para dropdown de pais ───
function buildParentOptions(contacts, excludeId) {
  const tree = buildTree(contacts);
  const options = [];
  const excludeIds = excludeId ? getDescendantIds(contacts, excludeId) : new Set();
  if (excludeId) excludeIds.add(excludeId);

  const walk = (nodes, depth) => {
    nodes.forEach(node => {
      if (!excludeIds.has(node.id)) {
        const indent = '\u2003'.repeat(depth);
        options.push({
          id: node.id,
          label: `${indent}${node.role} — ${node.is_placeholder ? '(por identificar)' : node.name}`,
        });
        walk(node.children, depth + 1);
      }
    });
  };
  walk(tree, 0);
  return options;
}

// ─── Card de Contacto (modal) ───
function ContactCard({ contact, contacts, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    name: contact?.name || '',
    role: contact?.role || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    zone: contact?.zone || '',
    notes: contact?.notes || '',
    action_text: contact?.action_text || '',
    action_status: contact?.action_status || 'none',
    action_due_date: contact?.action_due_date ? contact.action_due_date.split('T')[0] : '',
    is_placeholder: contact?.is_placeholder || false,
    parent_id: contact?.parent_id || null,
  });

  const [parentChanged, setParentChanged] = useState(false);

  const parentOptions = useMemo(() => {
    return buildParentOptions(contacts || [], contact?.id);
  }, [contacts, contact?.id]);

  const handleParentChange = (value) => {
    const newParentId = value === '' ? null : parseInt(value);
    setForm({ ...form, parent_id: newParentId });
    setParentChanged(true);
  };

  const handleSave = () => {
    if (!form.name && !form.is_placeholder) {
      if (!form.role) return alert('Preenche pelo menos o cargo para posições vazias');
      setForm(f => ({ ...f, is_placeholder: true }));
    }
    const payload = { ...form, action_due_date: form.action_due_date || null };
    if (!parentChanged) {
      delete payload.parent_id;
    }
    onSave(payload);
  };

  const actionStatusConfig = {
    none: { label: 'Sem acção', color: '#9ca3af', bg: '#f9fafb' },
    pendente: { label: 'Pendente', color: '#f59e0b', bg: '#fffbeb' },
    em_curso: { label: 'Em Curso', color: '#3b82f6', bg: '#eff6ff' },
    concluido: { label: 'Concluído', color: '#16a34a', bg: '#f0fdf4' },
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.cardModal} onClick={e => e.stopPropagation()}>
        <div style={styles.cardHeader}>
          <div>
            <h3 style={styles.cardTitle}>
              {contact?.id ? 'Editar Contacto' : 'Novo Contacto'}
            </h3>
            {contact?.is_placeholder && (
              <span style={styles.placeholderBadge}>Posição por identificar</span>
            )}
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Checkbox placeholder */}
        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.is_placeholder}
            onChange={e => setForm({
              ...form,
              is_placeholder: e.target.checked,
              name: e.target.checked ? '' : form.name
            })}
          />
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            Posição conhecida mas pessoa não identificada
          </span>
        </label>

        <div style={styles.cardGrid}>
          {/* Nome */}
          {!form.is_placeholder && (
            <div style={styles.cardField}>
              <label style={styles.cardLabel}>Nome</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                style={styles.cardInput}
                placeholder="Nome completo..."
              />
            </div>
          )}

          {/* Cargo */}
          <div style={styles.cardField}>
            <label style={styles.cardLabel}>Cargo / Função *</label>
            <input
              type="text"
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              style={styles.cardInput}
              placeholder="Ex: Director Comercial, Comercial, Técnico..."
            />
          </div>

          {/* Telefone */}
          {!form.is_placeholder && (
            <div style={styles.cardField}>
              <label style={styles.cardLabel}>Telefone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                style={styles.cardInput}
                placeholder="+351 ..."
              />
            </div>
          )}

          {/* Email */}
          {!form.is_placeholder && (
            <div style={styles.cardField}>
              <label style={styles.cardLabel}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                style={styles.cardInput}
                placeholder="email@empresa.pt"
              />
            </div>
          )}

          {/* Zona */}
          <div style={styles.cardField}>
            <label style={styles.cardLabel}>Zona</label>
            <select
              value={form.zone}
              onChange={e => setForm({ ...form, zone: e.target.value })}
              style={styles.cardSelect}
            >
              <option value="">Seleccionar...</option>
              <option value="Norte">Norte</option>
              <option value="Centro">Centro</option>
              <option value="Lisboa">Lisboa</option>
              <option value="Sul">Sul</option>
              <option value="Ilhas">Ilhas</option>
              <option value="Nacional">Nacional</option>
            </select>
          </div>
        </div>

        {/* Mover para — só aparece em edição */}
        {contact?.id && (
          <div style={{ ...styles.cardField, marginTop: '12px' }}>
            <label style={styles.cardLabel}>📂 Mover para (superior hierárquico)</label>
            <select
              value={form.parent_id || ''}
              onChange={e => handleParentChange(e.target.value)}
              style={styles.cardSelect}
            >
              <option value="">— Raiz (sem superior) —</option>
              {parentOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            {parentChanged && (
              <span style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
                ⚠️ Este contacto será movido na árvore ao guardar
              </span>
            )}
          </div>
        )}

        {/* Notas */}
        <div style={{ ...styles.cardField, marginTop: '12px' }}>
          <label style={styles.cardLabel}>📝 Notas (contexto permanente)</label>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            style={styles.cardTextarea}
            rows={3}
            placeholder="Informação de contexto: preferências, historial, relações, hábitos de compra..."
          />
        </div>

        {/* Separador Acção */}
        <div style={styles.actionSeparator}>
          <span style={styles.actionSeparatorText}>🎯 Acção Estratégica</span>
        </div>

        {/* Acção */}
        <div style={styles.cardGrid}>
          <div style={{ ...styles.cardField, gridColumn: '1 / -1' }}>
            <label style={styles.cardLabel}>Acção</label>
            <input
              type="text"
              value={form.action_text}
              onChange={e => setForm({ ...form, action_text: e.target.value })}
              style={styles.cardInput}
              placeholder="Ex: Fazer demo Hikvision, Enviar tabela AJAX..."
            />
          </div>

          <div style={styles.cardField}>
            <label style={styles.cardLabel}>Estado</label>
            <select
              value={form.action_status}
              onChange={e => setForm({ ...form, action_status: e.target.value })}
              style={styles.cardSelect}
            >
              {Object.entries(actionStatusConfig).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.cardField}>
            <label style={styles.cardLabel}>Data Alvo</label>
            <input
              type="date"
              value={form.action_due_date}
              onChange={e => setForm({ ...form, action_due_date: e.target.value })}
              style={styles.cardInput}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={styles.cardFooter}>
          {contact?.id && (
            <button
              onClick={() => {
                if (window.confirm('Eliminar este contacto e todos os sub-contactos?')) {
                  onDelete(contact.id);
                }
              }}
              style={styles.deleteBtn}
            >
              🗑️ Eliminar
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={styles.cancelBtn}>Cancelar</button>
          <button onClick={handleSave} style={styles.saveBtn}>
            {contact?.id ? 'Actualizar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Nó da Árvore (recursivo) ───
function TreeNode({ node, level, onEdit, onAddChild, maxLevel }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const canAddChild = level < maxLevel;

  const actionDot = {
    none: null,
    pendente: '#f59e0b',
    em_curso: '#3b82f6',
    concluido: '#16a34a',
  };

  const dotColor = actionDot[node.action_status];

  return (
    <div style={{ marginLeft: level === 1 ? 0 : 24 }}>
      <div style={{
        ...styles.treeRow,
        opacity: node.is_placeholder ? 0.6 : 1,
        borderStyle: node.is_placeholder ? 'dashed' : 'solid',
      }}>
        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={styles.expandBtn}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : '●'}
        </button>

        {/* Info principal — clicável */}
        <div
          onClick={() => onEdit(node)}
          style={styles.treeNodeContent}
        >
          <div style={styles.treeNodeMain}>
            {dotColor && (
              <span style={{ ...styles.actionDot, background: dotColor }} />
            )}
            <span style={styles.treeNodeRole}>
              {node.role || 'Sem cargo'}
            </span>
            <span style={styles.treeNodeSep}>—</span>
            <span style={{
              ...styles.treeNodeName,
              fontStyle: node.is_placeholder ? 'italic' : 'normal',
              color: node.is_placeholder ? '#9ca3af' : '#111827',
            }}>
              {node.is_placeholder ? '(por identificar)' : (node.name || '—')}
            </span>
            {node.zone && (
              <span style={styles.treeNodeZone}>{node.zone}</span>
            )}
          </div>

          {node.action_text && node.action_status !== 'none' && (
            <div style={styles.treeNodeAction}>
              🎯 {node.action_text}
              {node.action_due_date && (
                <span style={styles.actionDate}>
                  {new Date(node.action_due_date).toLocaleDateString('pt-PT')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Botão adicionar filho */}
        {canAddChild && (
          <button
            onClick={() => onAddChild(node.id, level + 1)}
            style={styles.addChildBtn}
            title="Adicionar sub-contacto"
          >
            +
          </button>
        )}
      </div>

      {/* Filhos */}
      {expanded && hasChildren && (
        <div style={styles.childrenContainer}>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onEdit={onEdit}
              onAddChild={onAddChild}
              maxLevel={maxLevel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ───
export default function OrgTree({ strategyId, clientName, onClose }) {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingContact, setEditingContact] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [newParentId, setNewParentId] = useState(null);
  const [newLevel, setNewLevel] = useState(1);

  const MAX_LEVEL = 4;

  useEffect(() => {
    fetchContacts();
  }, [strategyId]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const [contactsRes, statsRes] = await Promise.all([
        api.get(`/estrategia/${strategyId}/contacts`),
        api.get(`/estrategia/${strategyId}/contacts/stats`),
      ]);
      setContacts(contactsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Fetch contacts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const tree = useMemo(() => buildTree(contacts), [contacts]);

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setNewParentId(null);
    setShowCard(true);
  };

  const handleAddRoot = () => {
    setEditingContact(null);
    setNewParentId(null);
    setNewLevel(1);
    setShowCard(true);
  };

  const handleAddChild = (parentId, level) => {
    setEditingContact(null);
    setNewParentId(parentId);
    setNewLevel(level);
    setShowCard(true);
  };

  const handleSave = async (formData) => {
    try {
      if (editingContact?.id) {
        await api.put(`/estrategia/contacts/${editingContact.id}`, formData);
      } else {
        await api.post(`/estrategia/${strategyId}/contacts`, {
          ...formData,
          parent_id: newParentId,
          tree_level: newLevel,
        });
      }
      setShowCard(false);
      setEditingContact(null);
      fetchContacts();
    } catch (err) {
      console.error('Save contact error:', err);
      alert('Erro ao gravar contacto');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/estrategia/contacts/${id}`);
      setShowCard(false);
      setEditingContact(null);
      fetchContacts();
    } catch (err) {
      console.error('Delete contact error:', err);
      alert('Erro ao eliminar contacto');
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: '14px'
      }}>
        A carregar...
      </div>
    );
  }

  const coverage = stats && stats.total > 0
    ? Math.round((stats.identified / stats.total) * 100)
    : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            <button onClick={onClose} style={styles.backBtn}>← Voltar</button>
            <span style={styles.breadcrumbSep}>/</span>
            <span style={styles.breadcrumbCurrent}>Estrutura Organizacional</span>
          </div>
          <h2 style={styles.title}>{clientName}</h2>
        </div>
        <button onClick={handleAddRoot} style={styles.addRootBtn}>
          + Adicionar Nível 1
        </button>
      </div>

      {/* Stats Bar */}
      {stats && stats.total > 0 && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.total}</span>
            <span style={styles.statLabel}>Total</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: '#16a34a' }}>
              {stats.identified}
            </span>
            <span style={styles.statLabel}>Identificados</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: '#9ca3af' }}>
              {stats.placeholders}
            </span>
            <span style={styles.statLabel}>Por identificar</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: '#f59e0b' }}>
              {stats.actions_pending}
            </span>
            <span style={styles.statLabel}>Acções Pend.</span>
          </div>
          <div style={styles.statItem}>
            <div style={styles.coverageBar}>
              <div style={{
                ...styles.coverageFill,
                width: `${coverage}%`
              }} />
            </div>
            <span style={styles.statLabel}>{coverage}% Cobertura</span>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: '#f59e0b' }} /> Acção pendente
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: '#3b82f6' }} /> Em curso
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: '#16a34a' }} /> Concluída
        </span>
        <span style={styles.legendItem}>
          <span style={{
            ...styles.legendDot,
            borderStyle: 'dashed',
            border: '1px dashed #9ca3af'
          }} /> Por identificar
        </span>
      </div>

      {/* Árvore */}
      {tree.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: '48px' }}>🏢</span>
          <p style={styles.emptyTitle}>Estrutura não definida</p>
          <p style={styles.emptyText}>
            Começa por adicionar os cargos de nível 1 (Directores)
          </p>
          <button onClick={handleAddRoot} style={styles.addRootBtn}>
            + Adicionar primeiro contacto
          </button>
        </div>
      ) : (
        <div style={styles.treeContainer}>
          {tree.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              level={1}
              onEdit={handleEdit}
              onAddChild={handleAddChild}
              maxLevel={MAX_LEVEL}
            />
          ))}
        </div>
      )}

      {/* Card Modal */}
      {showCard && (
        <ContactCard
          contact={editingContact}
          contacts={contacts}
          onClose={() => {
            setShowCard(false);
            setEditingContact(null);
          }}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ─── STYLES ───
const styles = {
  container: {
    padding: '0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '13px',
    color: '#667eea',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    fontWeight: '500',
  },
  breadcrumbSep: {
    color: '#d1d5db',
    fontSize: '13px',
  },
  breadcrumbCurrent: {
    fontSize: '13px',
    color: '#6b7280',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  addRootBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  // Stats
  statsBar: {
    display: 'flex',
    gap: '16px',
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '16px 24px',
    marginBottom: '16px',
    alignItems: 'center',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    flex: 1,
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  coverageBar: {
    width: '80px',
    height: '8px',
    background: '#f3f4f6',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  coverageFill: {
    height: '100%',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderRadius: '4px',
    transition: 'width 0.3s',
  },
  // Legend
  legend: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
    fontSize: '11px',
    color: '#6b7280',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  // Tree
  treeContainer: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '20px',
  },
  treeRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #f3f4f6',
    marginBottom: '4px',
    transition: 'all 0.15s',
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    fontSize: '10px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px',
    minWidth: '20px',
    marginTop: '2px',
  },
  treeNodeContent: {
    flex: 1,
    cursor: 'pointer',
    padding: '2px 0',
  },
  treeNodeMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  actionDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  treeNodeRole: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#667eea',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  treeNodeSep: {
    color: '#d1d5db',
    fontSize: '13px',
  },
  treeNodeName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#111827',
  },
  treeNodeZone: {
    fontSize: '11px',
    color: '#6b7280',
    background: '#f3f4f6',
    padding: '1px 8px',
    borderRadius: '4px',
  },
  treeNodeAction: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
    paddingLeft: '14px',
  },
  actionDate: {
    fontSize: '11px',
    color: '#9ca3af',
    marginLeft: '8px',
  },
  addChildBtn: {
    background: 'none',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#667eea',
    cursor: 'pointer',
    padding: '0 6px',
    fontWeight: '600',
    opacity: 0.5,
    transition: 'opacity 0.15s',
    marginTop: '2px',
  },
  childrenContainer: {
    borderLeft: '2px solid #e5e7eb',
    marginLeft: '9px',
    paddingLeft: '0',
  },
  // Empty
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '8px',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
    margin: 0,
  },
  emptyText: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: 0,
  },
  // Card Modal
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  cardModal: {
    background: 'white',
    borderRadius: '16px',
    padding: '28px',
    width: '560px',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  placeholderBadge: {
    fontSize: '11px',
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: '2px',
    display: 'block',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#9ca3af',
    cursor: 'pointer',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    cursor: 'pointer',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },
  cardField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cardLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  cardInput: {
    padding: '9px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  cardSelect: {
    padding: '9px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    background: 'white',
    cursor: 'pointer',
  },
  cardTextarea: {
    padding: '9px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
    lineHeight: '1.5',
  },
  actionSeparator: {
    borderTop: '1px solid #e5e7eb',
    margin: '20px 0 16px',
    paddingTop: '16px',
  },
  actionSeparatorText: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #f3f4f6',
  },
  deleteBtn: {
    padding: '9px 16px',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    fontSize: '13px',
    background: '#fef2f2',
    color: '#dc2626',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  cancelBtn: {
    padding: '9px 18px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    background: 'white',
    color: '#374151',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: '9px 18px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};