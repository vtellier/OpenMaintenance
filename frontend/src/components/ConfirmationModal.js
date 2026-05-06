import React from 'react';

const ConfirmationModal = ({ onClose, onConfirm, message }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
        <p className="mb-6">{message}</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="mr-2 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 focus:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;