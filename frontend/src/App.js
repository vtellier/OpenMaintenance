import { useState } from 'react';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const equipmentTabs = [
    { id: 0, name: "Boat" },
    { id: 1, name: "Car" },
    { id: 2, name: "Home" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">OpenMaintenance</h1>
        
        <div className="flex border-b border-gray-200 mb-4">
          {equipmentTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-4 font-medium text-sm focus:outline-none ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          {equipmentTabs.map((tab) => (
            <div key={tab.id} className={activeTab === tab.id ? "block" : "hidden"}>
              <h2 className="text-xl font-semibold mb-4">{tab.name} Maintenance</h2>
              <p>Content for {tab.name} will appear here.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
