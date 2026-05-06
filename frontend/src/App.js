import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [equipments, setEquipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEquipments = async () => {
      try {
        const response = await fetch('http://localhost:3001/equipments');
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

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">OpenMaintenance</h1>
        
         <div className="flex border-b border-gray-200 mb-4">
           {loading ? (
             <p>Loading equipments...</p>
           ) : (
             equipments.map((equipment) => (
               <button
                 key={equipment.id}
                 onClick={() => setActiveTab(equipment.id)}
                 className={`py-2 px-4 font-medium text-sm focus:outline-none ${
                   activeTab === equipment.id
                     ? "text-blue-600 border-b-2 border-blue-600"
                     : "text-gray-500 hover:text-gray-700"
                 }`}
               >
                 {equipment.name}
               </button>
             ))
           )}
         </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            {loading ? (
              <p>Loading equipment details...</p>
            ) : (
              <>
                {equipments.map((equipment) => (
                  <div key={equipment.id} className={activeTab === equipment.id ? "block" : "hidden"}>
                    <h2 className="text-xl font-semibold mb-4">{equipment.name} Maintenance</h2>
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
