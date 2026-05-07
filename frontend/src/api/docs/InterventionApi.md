# Openmaintenance.InterventionApi

All URIs are relative to *http://localhost:3001/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**interventionsGet**](InterventionApi.md#interventionsGet) | **GET** /interventions | List all interventions
[**interventionsIdDelete**](InterventionApi.md#interventionsIdDelete) | **DELETE** /interventions/{id} | Delete an intervention
[**interventionsIdGet**](InterventionApi.md#interventionsIdGet) | **GET** /interventions/{id} | Get intervention by ID
[**interventionsIdPut**](InterventionApi.md#interventionsIdPut) | **PUT** /interventions/{id} | Update an intervention
[**interventionsPost**](InterventionApi.md#interventionsPost) | **POST** /interventions | Create a new intervention



## interventionsGet

> [Intervention] interventionsGet()

List all interventions

Retrieve a list of all interventions

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.InterventionApi();
apiInstance.interventionsGet().then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters

This endpoint does not need any parameter.

### Return type

[**[Intervention]**](Intervention.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## interventionsIdDelete

> interventionsIdDelete(id)

Delete an intervention

Remove an intervention from the system

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.InterventionApi();
let id = 56; // Number | ID of the intervention
apiInstance.interventionsIdDelete(id).then(() => {
  console.log('API called successfully.');
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **Number**| ID of the intervention | 

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


## interventionsIdGet

> Intervention interventionsIdGet(id)

Get intervention by ID

Retrieve a single intervention by its ID

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.InterventionApi();
let id = 56; // Number | ID of the intervention
apiInstance.interventionsIdGet(id).then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **Number**| ID of the intervention | 

### Return type

[**Intervention**](Intervention.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## interventionsIdPut

> Intervention interventionsIdPut(id, intervention)

Update an intervention

Update an existing intervention

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.InterventionApi();
let id = 56; // Number | ID of the intervention
let intervention = new Openmaintenance.Intervention(); // Intervention | 
apiInstance.interventionsIdPut(id, intervention).then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **Number**| ID of the intervention | 
 **intervention** | [**Intervention**](Intervention.md)|  | 

### Return type

[**Intervention**](Intervention.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## interventionsPost

> Intervention interventionsPost(intervention)

Create a new intervention

Add a new intervention to the system

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.InterventionApi();
let intervention = new Openmaintenance.Intervention(); // Intervention | 
apiInstance.interventionsPost(intervention).then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **intervention** | [**Intervention**](Intervention.md)|  | 

### Return type

[**Intervention**](Intervention.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

