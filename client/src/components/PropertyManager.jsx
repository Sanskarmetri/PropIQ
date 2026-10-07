import { useCallback, useEffect, useState } from 'react';
import { Check, CircleAlert, Home, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from './Button.jsx';
import { Reveal } from './Reveal.jsx';
import { StatusPill } from './StatusPill.jsx';
import { createProperty, deleteProperty, getMyProperties, updateProperty } from '../services/api.js';
import { formatArea, formatCompactCurrency, formatPropertyType, propertyTypeLabels } from '../utils/formatters.js';

const LISTING_FIELDS = [
  { name: 'title', label: 'Listing title', type: 'text', placeholder: 'e.g. Sunlit Courtyard Residence' },
  { name: 'locality', label: 'Locality', type: 'text', placeholder: 'e.g. Indiranagar' },
  { name: 'city', label: 'City', type: 'text', placeholder: 'e.g. Bengaluru' },
  { name: 'propertyType', label: 'Property type', type: 'select' },
  { name: 'builtUpArea', label: 'Built-up area (sq.ft.)', type: 'number', min: 1 },
  { name: 'askingPrice', label: 'Asking price (INR)', type: 'number', min: 1, prefix: '₹' },
  { name: 'bedrooms', label: 'Bedrooms', type: 'number', min: 0 },
  { name: 'bathrooms', label: 'Bathrooms', type: 'number', min: 0 },
  { name: 'propertyAge', label: 'Property age (years)', type: 'number', min: 0 },
  { name: 'amenities', label: 'Amenities', type: 'text', placeholder: 'Comma separated', wide: true },
  { name: 'status', label: 'Listing status', type: 'select', status: true },
  { name: 'description', label: 'Description', type: 'textarea', wide: true },
];

const emptyForm = {
  title: '',
  locality: '',
  city: '',
  propertyType: 'apartment',
  builtUpArea: '',
  askingPrice: '',
  bedrooms: '',
  bathrooms: '',
  propertyAge: '',
  amenities: '',
  status: 'active',
  description: '',
};

const numericFields = ['builtUpArea', 'askingPrice', 'bedrooms', 'bathrooms', 'propertyAge'];

const validate = (form) => {
  const errors = {};
  if (!form.title.trim()) errors.title = 'Listing title is required';
  if (!form.locality.trim()) errors.locality = 'Locality is required';
  if (!form.city.trim()) errors.city = 'City is required';
  if (!form.propertyType) errors.propertyType = 'Choose a property type';

  numericFields.forEach((field) => {
    if (form[field] === '') return;
    const value = Number(form[field]);
    if (Number.isNaN(value)) errors[field] = 'Enter a valid number';
    else if (value < 0) errors[field] = 'Must be 0 or more';
  });

  if (form.builtUpArea !== '' && Number(form.builtUpArea) <= 0) errors.builtUpArea = 'Must be greater than 0';
  if (form.askingPrice !== '' && Number(form.askingPrice) <= 0) errors.askingPrice = 'Must be greater than 0';
  return errors;
};

const toPayload = (form) => ({
  title: form.title.trim(),
  description: form.description.trim(),
  locality: form.locality.trim(),
  city: form.city.trim(),
  propertyType: form.propertyType,
  builtUpArea: Number(form.builtUpArea),
  askingPrice: Number(form.askingPrice),
  bedrooms: form.bedrooms === '' ? 0 : Number(form.bedrooms),
  bathrooms: form.bathrooms === '' ? 0 : Number(form.bathrooms),
  propertyAge: form.propertyAge === '' ? 0 : Number(form.propertyAge),
  amenities: form.amenities
    .split(',')
    .map((amenity) => amenity.trim())
    .filter(Boolean),
});

const toFormState = (property) => ({
  title: property.title,
  description: property.description,
  locality: property.locality,
  city: property.city,
  propertyType: property.propertyType,
  builtUpArea: String(property.builtUpArea),
  askingPrice: String(property.askingPrice),
  bedrooms: String(property.bedrooms),
  bathrooms: String(property.bathrooms),
  propertyAge: String(property.propertyAge),
  amenities: property.amenities.join(', '),
  status: property.status,
});

export function PropertyManager({ user }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [listings, setListings] = useState({ status: 'loading', items: [], message: '' });
  const [feedback, setFeedback] = useState({ tone: 'success', message: '' });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const isAdmin = user.role === 'admin';

  const loadListings = useCallback(async () => {
    setListings((current) => ({ ...current, status: 'loading' }));
    try {
      const payload = await getMyProperties({ limit: 50 });
      setListings({ status: 'ready', items: payload.data.properties, message: '' });
    } catch (error) {
      setListings({ status: 'error', items: [], message: error.message });
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const startEdit = (property) => {
    setForm(toFormState(property));
    setErrors({});
    setEditingId(property.id);
    setFeedback({ tone: 'success', message: `Editing “${property.title}”.` });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setErrors({});
    setEditingId(null);
  };

  const cancelEdit = () => {
    resetForm();
    setFeedback({ tone: 'success', message: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setFeedback({ tone: 'error', message: 'Please fix the highlighted fields.' });
      return;
    }

    setSaving(true);
    setFeedback({ tone: 'success', message: '' });
    const payload = toPayload(form);
    try {
      if (editingId) {
        const result = await updateProperty(editingId, payload);
        resetForm();
        setFeedback({ tone: 'success', message: `“${result.data.property.title}” was updated.` });
      } else {
        const result = await createProperty({ ...payload, status: form.status });
        resetForm();
        setFeedback({ tone: 'success', message: `“${result.data.property.title}” is now listed.` });
      }
      await loadListings();
    } catch (error) {
      if (error.details) setErrors(error.details);
      setFeedback({ tone: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const removeListing = async (property) => {
    if (!window.confirm(`Delete “${property.title}”? This cannot be undone.`)) return;

    setBusyId(property.id);
    setFeedback({ tone: 'success', message: '' });
    try {
      await deleteProperty(property.id);
      if (editingId === property.id) resetForm();
      setFeedback({ tone: 'success', message: `“${property.title}” was deleted.` });
      await loadListings();
    } catch (error) {
      setFeedback({ tone: 'error', message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Reveal className="dashboard-chart-card">
        <div className="dashboard-card-heading">
          <div>
            <p className="eyebrow">Your listings</p>
            <h2>{editingId ? 'Update this listing.' : 'Publish a property.'}</h2>
          </div>
          <span className="preview-chip preview-chip-light">
            <span className="status-dot" /> {isAdmin ? 'Admin access' : 'Seller access'}
          </span>
        </div>

        <form className="listing-form" onSubmit={handleSubmit} noValidate>
          {LISTING_FIELDS.map((field) => {
            const error = errors[field.name];
            const describedBy = error ? `${field.name}-error` : undefined;
            const common = {
              id: field.name,
              name: field.name,
              value: form[field.name],
              onChange: updateField,
              'aria-invalid': Boolean(error),
              'aria-describedby': describedBy,
            };

            return (
              <div className={`form-field ${field.wide ? 'form-field-wide' : ''}`.trim()} key={field.name}>
                <label htmlFor={field.name}>{field.label}</label>
                {field.type === 'select' ? (
                  <select {...common}>
                    {field.status
                      ? ['active', 'inactive', 'sold'].map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))
                      : Object.entries(propertyTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                  </select>
                ) : null}
                {field.type === 'textarea' ? <textarea rows="3" placeholder="What should a buyer know about this home?" {...common} /> : null}
                {field.type === 'text' || field.type === 'number' ? (
                  field.prefix ? (
                    <div className="input-prefix-wrap">
                      <span>{field.prefix}</span>
                      <input placeholder={field.placeholder} min={field.min} type={field.type} inputMode={field.type === 'number' ? 'decimal' : undefined} {...common} />
                    </div>
                  ) : (
                    <input placeholder={field.placeholder} min={field.min} type={field.type} inputMode={field.type === 'number' ? 'decimal' : undefined} {...common} />
                  )
                ) : null}
                {error ? <span className="field-error" id={describedBy}>{error}</span> : null}
              </div>
            );
          })}

          <div className="form-submit-row form-field-wide">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? 'Saving…' : editingId ? <><Check size={17} /> Save changes</> : <><Plus size={17} /> Publish listing</>}
            </Button>
            {editingId ? (
              <Button type="button" variant="text" onClick={cancelEdit}>
                <X size={15} /> Cancel edit
              </Button>
            ) : null}
          </div>
        </form>

        {feedback.message ? (
          <div className={`form-message form-message-${feedback.tone}`} role="status">
            {feedback.tone === 'error' ? <CircleAlert size={15} /> : <Check size={15} />}
            <span>{feedback.message}</span>
          </div>
        ) : null}
      </Reveal>

      <Reveal className="activity-card" delay={0.1}>
        <div className="dashboard-card-heading">
          <div>
            <p className="eyebrow">{isAdmin ? 'Manage your listings · admins can also edit any listing' : 'Manage'}</p>
            <h2>Your current listings.</h2>
          </div>
          <span className="preview-chip preview-chip-light">
            <Home size={13} /> {listings.status === 'ready' ? `${listings.items.length} shown` : 'Loading'}
          </span>
        </div>

        <div className="activity-list">
          {listings.status === 'loading' ? (
            <div className="activity-row">
              <span className="activity-icon activity-icon-positive"><Home size={17} /></span>
              <div className="activity-property"><strong>Loading your listings…</strong><span>Fetching from the PropIQ API</span></div>
            </div>
          ) : null}

          {listings.status === 'error' ? (
            <div className="activity-row">
              <span className="activity-icon activity-icon-warning"><CircleAlert size={17} /></span>
              <div className="activity-property"><strong>We could not load your listings</strong><span>{listings.message}</span></div>
            </div>
          ) : null}

          {listings.status === 'ready' && listings.items.length === 0 ? (
            <div className="activity-row">
              <span className="activity-icon activity-icon-positive"><Home size={17} /></span>
              <div className="activity-property"><strong>No listings yet</strong><span>Publish your first property with the form above</span></div>
            </div>
          ) : null}

          {listings.items.map((property) => (
            <div className="listing-row" key={property.id}>
              <span className="activity-icon activity-icon-positive"><Home size={17} /></span>
              <div className="activity-property">
                <strong>{property.title}</strong>
                <span><MapPin size={13} /> {property.locality}, {property.city} · {formatPropertyType(property.propertyType)}</span>
              </div>
              <div className="activity-signal">
                <strong>{formatCompactCurrency(property.askingPrice)}</strong>
                <span>{formatArea(property.builtUpArea)} · {property.bedrooms} bed</span>
              </div>
              <div className="listing-actions">
                <StatusPill status={property.status} compact />
                <Button variant="secondary" size="sm" onClick={() => startEdit(property)}>
                  <Pencil size={14} /> Edit
                </Button>
                <Button variant="text" size="sm" disabled={busyId === property.id} onClick={() => removeListing(property)}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </>
  );
}
