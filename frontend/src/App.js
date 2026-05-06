import { useState, useEffect } from 'react';
import './index.css';
import ConfirmationModal from './components/ConfirmationModal';



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
  const [loading, setLoading] = useState(true);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState(null);

  useEffect(() => {
    const fetchEquipments = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/equipments');
        if (!response.ok) {
          throw new Error('Failed to fetch equipments');
        }
        const data = await response.json();
        setEquipments(data);
      } catch (error) {
        console.error('Error fetching equipments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEquipments();
  }, []);

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
    } catch (error) {
      console.error('Error deleting equipment:', error);
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
    } catch (error) {
      console.error('Error adding equipment:', error);
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

        <div className="bg-white p-6 rounded-lg shadow-sm">
          {loading ? (
            <p>Loading equipment details...</p>
          ) : (
            <>
              {equipments.map((equipment) => (
                <div key={equipment.id} className={activeTab === equipment.id ? "block" : "hidden"}>
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-semibold mb-4">{equipment.name} Maintenance</h2>
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
                  <p>{equipment.description || `No description available for ${equipment.name}.`}</p>
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