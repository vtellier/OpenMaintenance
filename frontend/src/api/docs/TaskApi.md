# Openmaintenance.TaskApi

All URIs are relative to *http://localhost:3001/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**tasksGet**](TaskApi.md#tasksGet) | **GET** /tasks | List all tasks
[**tasksIdDelete**](TaskApi.md#tasksIdDelete) | **DELETE** /tasks/{id} | Delete a task
[**tasksIdGet**](TaskApi.md#tasksIdGet) | **GET** /tasks/{id} | Get task by ID
[**tasksIdPut**](TaskApi.md#tasksIdPut) | **PUT** /tasks/{id} | Update a task
[**tasksPost**](TaskApi.md#tasksPost) | **POST** /tasks | Create a new task



## tasksGet

> [Task] tasksGet()

List all tasks

Retrieve a list of all tasks

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.TaskApi();
apiInstance.tasksGet().then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters

This endpoint does not need any parameter.

### Return type

[**[Task]**](Task.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## tasksIdDelete

> tasksIdDelete(id)

Delete a task

Remove a task from the system

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.TaskApi();
let id = 56; // Number | ID of the task
apiInstance.tasksIdDelete(id).then(() => {
  console.log('API called successfully.');
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **Number**| ID of the task | 

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


## tasksIdGet

> Task tasksIdGet(id)

Get task by ID

Retrieve a single task by its ID

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.TaskApi();
let id = 56; // Number | ID of the task
apiInstance.tasksIdGet(id).then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **Number**| ID of the task | 

### Return type

[**Task**](Task.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## tasksIdPut

> Task tasksIdPut(id, task)

Update a task

Update an existing task

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.TaskApi();
let id = 56; // Number | ID of the task
let task = new Openmaintenance.Task(); // Task | 
apiInstance.tasksIdPut(id, task).then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **Number**| ID of the task | 
 **task** | [**Task**](Task.md)|  | 

### Return type

[**Task**](Task.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## tasksPost

> Task tasksPost(task)

Create a new task

Add a new task to the system

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.TaskApi();
let task = new Openmaintenance.Task(); // Task | 
apiInstance.tasksPost(task).then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **task** | [**Task**](Task.md)|  | 

### Return type

[**Task**](Task.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

