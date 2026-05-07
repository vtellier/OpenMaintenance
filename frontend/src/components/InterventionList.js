import { useState } from 'react';
import AddInterventionForm from './AddInterventionForm';

export default function InterventionList({ interventions, onDelete, onAdd }) {
  const [showAddIntervention, setShowAddIntervention] = useState(false);

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Interventions</h3>
        <button
          onClick={() => setShowAddIntervention(true)}
          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 focus:outline-none"
        >
          Add Intervention
        </button>
      </div>
      {interventions.length === 0 ? (
        <p>No interventions recorded for this task.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {interventions.map((intervention) => (
            <li key={intervention.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-medium">
                  {new Date(intervention.date).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500">{intervention.location}</p>
                <p className="text-sm text-gray-500">{intervention.comments}</p>
              </div>
              <button
                onClick={() => onDelete(intervention.id)}
                className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 focus:outline-none"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      {showAddIntervention && (
        <AddInterventionForm
          taskId={interventions[0]?.taskId}
          onClose={() => setShowAddIntervention(false)}
          onAdd={onAdd}
        />
      )}
    </div>
  );
}