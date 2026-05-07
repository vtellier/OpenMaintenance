import { useState, useEffect } from 'react';
import './index.css';
import ConfirmationModal from './components/ConfirmationModal';
import TaskList from './components/TaskList';
import InterventionList from './components/InterventionList';
import EditEquipmentForm from './components/EditEquipmentForm';



function AddEquipmentForm({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onAdd({ name, description });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add New Equipment</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [equipments, setEquipments] = useState([]);
  const [tasks, setTasks] = useState({});
  const [interventions, setInterventions] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showEditEquipment, setShowEditEquipment] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState(null);
  const [equipmentToEdit, setEquipmentToEdit] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch equipments
        const equipmentsResponse = await fetch('http://localhost:3001/api/equipments');
        if (!equipmentsResponse.ok) {
          throw new Error('Failed to fetch equipments');
        }
        const equipmentsData = await equipmentsResponse.json();
        setEquipments(equipmentsData);

        // Fetch tasks for each equipment
        const tasksData = {};
        for (const equipment of equipmentsData) {
          const tasksResponse = await fetch(`http://localhost:3001/api/equipments/${equipment.id}/tasks`);
          if (tasksResponse.ok) {
            tasksData[equipment.id] = await tasksResponse.json();
          }
        }
        setTasks(tasksData);

        // Fetch interventions for each task
        const interventionsData = {};
        for (const equipment of equipmentsData) {
          const equipmentTasks = tasksData[equipment.id] || [];
          for (const task of equipmentTasks) {
            const interventionsResponse = await fetch(`http://localhost:3001/api/tasks/${task.id}/interventions`);
            if (interventionsResponse.ok) {
              interventionsData[task.id] = await interventionsResponse.json();
            }
          }
        }
        setInterventions(interventionsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const handleDeleteEquipment = async (equipmentId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/equipments/${equipmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete equipment');
      }

      setEquipments(equipments.filter(equipment => equipment.id !== equipmentId));
      if (activeTab === equipmentId) {
        setActiveTab(equipments[0]?.id || 0);
      }
      showNotification('Equipment deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting equipment:', error);
      showNotification('Failed to delete equipment', 'error');
    }
  };

  const handleAddEquipment = async (newEquipment) => {
    try {
      const response = await fetch('http://localhost:3001/api/equipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEquipment),
      });

      if (!response.ok) {
        throw new Error('Failed to add equipment');
      }

      const addedEquipment = await response.json();
      setEquipments([...equipments, addedEquipment]);
      setShowAddEquipment(false);
      showNotification('Equipment added successfully', 'success');
    } catch (error) {
      console.error('Error adding equipment:', error);
      showNotification('Failed to add equipment', 'error');
    }
  };

  const handleEditEquipment = async (updatedEquipment) => {
    try {
      const response = await fetch(`http://localhost:3001/api/equipments/${updatedEquipment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedEquipment),
      });

      if (!response.ok) {
        throw new Error('Failed to update equipment');
      }

      const updatedEquipmentData = await response.json();
      setEquipments(equipments.map(equipment =>
        equipment.id === updatedEquipmentData.id ? updatedEquipmentData : equipment
      ));
      setShowEditEquipment(false);
      showNotification('Equipment updated successfully', 'success');
    } catch (error) {
      console.error('Error updating equipment:', error);
      showNotification('Failed to update equipment', 'error');
    }
  };

  const handleAddTask = async (newTask) => {
    try {
      const response = await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTask),
      });

      if (!response.ok) {
        throw new Error('Failed to add task');
      }

      const addedTask = await response.json();
      setTasks({
        ...tasks,
        [newTask.equipmentId]: [...(tasks[newTask.equipmentId] || []), addedTask]
      });
      showNotification('Task added successfully', 'success');
    } catch (error) {
      console.error('Error adding task:', error);
      showNotification('Failed to add task', 'error');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      const updatedTasks = { ...tasks };
      for (const equipmentId in updatedTasks) {
        updatedTasks[equipmentId] = updatedTasks[equipmentId].filter(task => task.id !== taskId);
      }
      setTasks(updatedTasks);
      showNotification('Task deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting task:', error);
      showNotification('Failed to delete task', 'error');
    }
  };

  const handleAddIntervention = async (newIntervention) => {
    try {
      const response = await fetch('http://localhost:3001/api/interventions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newIntervention),
      });

      if (!response.ok) {
        throw new Error('Failed to add intervention');
      }

      const addedIntervention = await response.json();
      setInterventions({
        ...interventions,
        [newIntervention.taskId]: [...(interventions[newIntervention.taskId] || []), addedIntervention]
      });
      showNotification('Intervention added successfully', 'success');
    } catch (error) {
      console.error('Error adding intervention:', error);
      showNotification('Failed to add intervention', 'error');
    }
  };

  const handleDeleteIntervention = async (interventionId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/interventions/${interventionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete intervention');
      }

      const updatedInterventions = { ...interventions };
      for (const taskId in updatedInterventions) {
        updatedInterventions[taskId] = updatedInterventions[taskId].filter(
          intervention => intervention.id !== interventionId
        );
      }
      setInterventions(updatedInterventions);
      showNotification('Intervention deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting intervention:', error);
      showNotification('Failed to delete intervention', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">OpenMaintenance</h1>

        <div className="flex justify-between items-center border-b border-gray-200 mb-4">
          <div className="flex">
            {loading ? (
              <p>Loading equipments...</p>
            ) : (
              equipments.map((equipment) => (
                <button
                  key={equipment.id}
                  onClick={() => setActiveTab(equipment.id)}
                  className={`py-2 px-4 font-medium text-sm focus:outline-none $
                    {
                      activeTab === equipment.id
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                    }
                  `}
                >
                  {equipment.name}
                </button>
              ))
            )}
          </div>
          <button
            onClick={() => setShowAddEquipment(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none"
          >
            Add New Equipment
          </button>
        </div>

        {showAddEquipment && (
          <AddEquipmentForm onClose={() => setShowAddEquipment(false)} onAdd={handleAddEquipment} />
        )}
        {showDeleteConfirmation && (
          <ConfirmationModal
            onClose={() => setShowDeleteConfirmation(false)}
            onConfirm={() => {
              handleDeleteEquipment(equipmentToDelete);
              setShowDeleteConfirmation(false);
            }}
            message="Are you sure you want to delete this equipment? This action cannot be undone."
          />
        )}
        {showEditEquipment && (
          <EditEquipmentForm
            equipment={equipmentToEdit}
            onClose={() => setShowEditEquipment(false)}
            onSave={handleEditEquipment}
          />
        )}
        {notification.show && (
          <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {notification.message}
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-sm">
          {loading ? (
            <p>Loading equipment details...</p>
          ) : (
            <>
              {equipments.map((equipment) => (
                <div key={equipment.id} className={activeTab === equipment.id ? "block" : "hidden"}>
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-semibold mb-4">{equipment.name} Maintenance</h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setEquipmentToEdit(equipment);
                          setShowEditEquipment(true);
                        }}
                        className="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 focus:outline-none"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEquipmentToDelete(equipment.id);
                          setShowDeleteConfirmation(true);
                        }}
                        className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 focus:outline-none"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="mb-4">{equipment.description || `No description available for ${equipment.name}.`}</p>

                  <TaskList
                    tasks={tasks[equipment.id] || []}
                    onDelete={handleDeleteTask}
                    onAdd={handleAddTask}
                  />

                  {tasks[equipment.id]?.map((task) => (
                    <div key={task.id} className="mt-6">
                      <h4 className="text-md font-semibold mb-2">Interventions for {task.name}</h4>
                      <InterventionList
                        interventions={interventions[task.id] || []}
                        onDelete={handleDeleteIntervention}
                        onAdd={handleAddIntervention}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;