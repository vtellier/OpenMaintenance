# Openmaintenance.EquipmentApi

All URIs are relative to *http://localhost:3001/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**equipmentsGet**](EquipmentApi.md#equipmentsGet) | **GET** /equipments | List all equipments
[**equipmentsIdDelete**](EquipmentApi.md#equipmentsIdDelete) | **DELETE** /equipments/{id} | Delete an equipment
[**equipmentsIdGet**](EquipmentApi.md#equipmentsIdGet) | **GET** /equipments/{id} | Get equipment by ID
[**equipmentsIdPut**](EquipmentApi.md#equipmentsIdPut) | **PUT** /equipments/{id} | Update an equipment
[**equipmentsPost**](EquipmentApi.md#equipmentsPost) | **POST** /equipments | Create a new equipment



## equipmentsGet

> [Equipment] equipmentsGet()

List all equipments

Retrieve a list of all equipments

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.EquipmentApi();
apiInstance.equipmentsGet().then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters

This endpoint does not need any parameter.

### Return type

[**[Equipment]**](Equipment.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## equipmentsIdDelete

> equipmentsIdDelete(id)

Delete an equipment

Remove an equipment from the system

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.EquipmentApi();
let id = 56; // Number | ID of the equipment
apiInstance.equipmentsIdDelete(id).then(() => {
  console.log('API called successfully.');
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **Number**| ID of the equipment | 

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


## equipmentsIdGet

> Equipment equipmentsIdGet(id)

Get equipment by ID

Retrieve a single equipment by its ID

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.EquipmentApi();
let id = 56; // Number | ID of the equipment
apiInstance.equipmentsIdGet(id).then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **Number**| ID of the equipment | 

### Return type

[**Equipment**](Equipment.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## equipmentsIdPut

> Equipment equipmentsIdPut(id, equipment)

Update an equipment

Update an existing equipment

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.EquipmentApi();
let id = 56; // Number | ID of the equipment
let equipment = new Openmaintenance.Equipment(); // Equipment | 
apiInstance.equipmentsIdPut(id, equipment).then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **Number**| ID of the equipment | 
 **equipment** | [**Equipment**](Equipment.md)|  | 

### Return type

[**Equipment**](Equipment.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## equipmentsPost

> Equipment equipmentsPost(equipment)

Create a new equipment

Add a new equipment to the system

### Example

```javascript
import Openmaintenance from 'openmaintenance';

let apiInstance = new Openmaintenance.EquipmentApi();
let equipment = new Openmaintenance.Equipment(); // Equipment | 
apiInstance.equipmentsPost(equipment).then((data) => {
  console.log('API called successfully. Returned data: ' + data);
}, (error) => {
  console.error(error);
});

```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **equipment** | [**Equipment**](Equipment.md)|  | 

### Return type

[**Equipment**](Equipment.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

