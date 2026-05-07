import { useQuery, useMutation, useQueryClient } from 'react-query';
import * as api from '../api/src/api/api/EquipmentApi';
import * as taskApi from '../api/src/api/api/TaskApi';
import * as interventionApi from '../api/src/api/api/InterventionApi';

// Query hooks for Equipments
export const useGetEquipments = () => {
  return useQuery('equipments', () => api.equipmentsGet());
};

export const useGetEquipmentById = (id) => {
  return useQuery(['equipment', id], () => api.equipmentsIdGet(id));
};

// Mutation hooks for Equipments
export const useCreateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation(api.equipmentsPost, {
    onSuccess: () => {
      queryClient.invalidateQueries('equipments');
    },
  });
};

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation(({ id, equipment }) => api.equipmentsIdPut(id, equipment), {
    onSuccess: () => {
      queryClient.invalidateQueries('equipments');
    },
  });
};

export const useDeleteEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation((id) => api.equipmentsIdDelete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('equipments');
    },
  });
};

// Query hooks for Tasks
export const useGetTasks = () => {
  return useQuery('tasks', () => taskApi.tasksGet());
};

export const useGetTaskById = (id) => {
  return useQuery(['task', id], () => taskApi.tasksIdGet(id));
};

// Mutation hooks for Tasks
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation(taskApi.tasksPost, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation(({ id, task }) => taskApi.tasksIdPut(id, task), {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation((id) => taskApi.tasksIdDelete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
    },
  });
};

// Query hooks for Interventions
export const useGetInterventions = () => {
  return useQuery('interventions', () => interventionApi.interventionsGet());
};

export const useGetInterventionById = (id) => {
  return useQuery(['intervention', id], () => interventionApi.interventionsIdGet(id));
};

// Mutation hooks for Interventions
export const useCreateIntervention = () => {
  const queryClient = useQueryClient();
  return useMutation(interventionApi.interventionsPost, {
    onSuccess: () => {
      queryClient.invalidateQueries('interventions');
    },
  });
};

export const useUpdateIntervention = () => {
  const queryClient = useQueryClient();
  return useMutation(({ id, intervention }) => interventionApi.interventionsIdPut(id, intervention), {
    onSuccess: () => {
      queryClient.invalidateQueries('interventions');
    },
  });
};

export const useDeleteIntervention = () => {
  const queryClient = useQueryClient();
  return useMutation((id) => interventionApi.interventionsIdDelete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('interventions');
    },
  });
};