import { useState } from 'react';
import AddTaskForm from './AddTaskForm';

export default function TaskList({ tasks, onDelete, onAdd }) {
  const [showAddTask, setShowAddTask] = useState(false);

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Tasks</h3>
        <button
          onClick={() => setShowAddTask(true)}
          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 focus:outline-none"
        >
          Add Task
        </button>
      </div>
      {tasks.length === 0 ? (
        <p>No tasks defined for this equipment.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {tasks.map((task) => (
            <li key={task.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{task.name}</p>
                <p className="text-sm text-gray-500">{task.description}</p>
                <p className="text-sm text-gray-500">
                  {task.hoursInterval ? `Every ${task.hoursInterval} hours` : ''}
                  {task.hoursInterval && task.monthsInterval ? ' or ' : ''}
                  {task.monthsInterval ? `Every ${task.monthsInterval} months` : ''}
                </p>
              </div>
              <button
                onClick={() => onDelete(task.id)}
                className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 focus:outline-none"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      {showAddTask && (
        <AddTaskForm
          equipmentId={tasks[0]?.equipmentId}
          onClose={() => setShowAddTask(false)}
          onAdd={onAdd}
        />
      )}
    </div>
  );
}