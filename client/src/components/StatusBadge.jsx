import React from 'react';
import { CheckCircle2, Clock, PackageCheck, Truck, XCircle, Sparkles } from 'lucide-react';

const STATUS_CLASS = {
  Available: 'badge-available',
  Requested: 'badge-requested',
  Pending: 'badge-pending',
  Accepted: 'badge-accepted',
  Distributed: 'badge-distributed',
  Completed: 'badge-completed',
  Rejected: 'badge-rejected',
  Deactivated: 'badge-deactivated',
  Cancelled: 'badge-cancelled',
};

export function StatusBadge({ status }) {
  const cls = STATUS_CLASS[status] || 'badge-role';
  let Icon = Sparkles;
  if (status === 'Pending' || status === 'Requested') Icon = Clock;
  if (status === 'Accepted') Icon = PackageCheck;
  if (status === 'Distributed') Icon = Truck;
  if (status === 'Completed') Icon = CheckCircle2;
  if (['Rejected', 'Deactivated', 'Cancelled'].includes(status)) Icon = XCircle;

  return (
    <span className={`badge ${cls}`}>
      <Icon size={13} />
      {status}
    </span>
  );
}

const FOOD_LIFECYCLE = ['Available', 'Requested', 'Accepted', 'Distributed', 'Completed'];

export function LifecycleStepper({ status }) {
  if (status === 'Deactivated' || status === 'Rejected' || status === 'Cancelled') {
    return <StatusBadge status={status} />;
  }

  const normalized = status === 'Pending' ? 'Requested' : status;
  const activeIdx = FOOD_LIFECYCLE.indexOf(normalized);

  return (
    <div className="stepper" aria-label="Food distribution lifecycle">
      {FOOD_LIFECYCLE.map((step, idx) => {
        const cls = idx < activeIdx ? 'done' : idx === activeIdx ? 'current' : '';
        return (
          <span key={step} className={`step-item ${cls}`}>
            {idx < activeIdx ? '✓ ' : ''}
            {step}
          </span>
        );
      })}
    </div>
  );
}
