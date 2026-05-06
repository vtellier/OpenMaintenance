package routes

import (
	"github.com/gofiber/fiber/v2"
)

func SetupViewRoutes(app *fiber.App) {
	app.Get("/equipments-view", func(c *fiber.Ctx) error {
		return c.SendString(`
		<div class="space-y-6">
			<h2 class="text-2xl font-bold">Equipment Management</h2>
			
			<!-- Equipment List -->
			<div id="equipment-list">
				<h3 class="text-xl font-semibold mb-4">Equipments</h3>
				<div 
					hx-get="/equipments" 
					hx-trigger="load"
					hx-swap="innerHTML">
					Loading equipments...
				</div>
			</div>
			
			<!-- Add Equipment Form -->
			<div class="mt-8">
				<h3 class="text-xl font-semibold mb-4">Add Equipment</h3>
				<form 
					hx-post="/equipments" 
					hx-target="#equipment-list"
					hx-swap="outerHTML">
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700">Name</label>
							<input 
								name="name" 
								type="text" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" 
								required>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">Description</label>
							<textarea 
								name="description" 
								rows="3" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea>
						</div>
						<button 
							type="submit" 
							class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
							Add Equipment
						</button>
					</div>
				</form>
			</div>
		</div>
		`)
	})

	app.Get("/tasks-view", func(c *fiber.Ctx) error {
		return c.SendString(`
		<div class="space-y-6">
			<h2 class="text-2xl font-bold">Task Management</h2>
			
			<!-- Task List -->
			<div id="task-list">
				<h3 class="text-xl font-semibold mb-4">Tasks</h3>
				<div 
					hx-get="/tasks" 
					hx-trigger="load"
					hx-swap="innerHTML">
					Loading tasks...
				</div>
			</div>
			
			<!-- Add Task Form -->
			<div class="mt-8">
				<h3 class="text-xl font-semibold mb-4">Add Task</h3>
				<form 
					hx-post="/tasks" 
					hx-target="#task-list"
					hx-swap="outerHTML">
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700">Equipment ID</label>
							<input 
								name="equipment_id" 
								type="number" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" 
								required>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">Name</label>
							<input 
								name="name" 
								type="text" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" 
								required>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">Description</label>
							<textarea 
								name="description" 
								rows="3" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">Hours Interval</label>
							<input 
								name="hours_interval" 
								type="number" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">Months Interval</label>
							<input 
								name="months_interval" 
								type="number" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
						</div>
						<button 
							type="submit" 
							class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
							Add Task
						</button>
					</div>
				</form>
			</div>
		</div>
		`)
	})

	app.Get("/interventions-view", func(c *fiber.Ctx) error {
		return c.SendString(`
		<div class="space-y-6">
			<h2 class="text-2xl font-bold">Intervention Management</h2>
			
			<!-- Intervention List -->
			<div id="intervention-list">
				<h3 class="text-xl font-semibold mb-4">Interventions</h3>
				<div 
					hx-get="/interventions" 
					hx-trigger="load"
					hx-swap="innerHTML">
					Loading interventions...
				</div>
			</div>
			
			<!-- Add Intervention Form -->
			<div class="mt-8">
				<h3 class="text-xl font-semibold mb-4">Add Intervention</h3>
				<form 
					hx-post="/interventions" 
					hx-target="#intervention-list"
					hx-swap="outerHTML">
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700">Task ID</label>
							<input 
								name="task_id" 
								type="number" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" 
								required>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">Date</label>
							<input 
								name="date" 
								type="datetime-local" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" 
								required>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">Location</label>
							<input 
								name="location" 
								type="text" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">Comments</label>
							<textarea 
								name="comments" 
								rows="3" 
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea>
						</div>
						<button 
							type="submit" 
							class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
							Add Intervention
						</button>
					</div>
				</form>
			</div>
		</div>
		`)
	})
}