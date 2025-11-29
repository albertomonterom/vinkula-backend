# Vinkula Backend

Backend implemented using a serverless architecture on AWS.  
This service provides authentication, user management, destination handling, provider listings, category retrieval, and image storage.

## Tech Stack

- Node.js
- AWS Lambda
- Amazon API Gateway
- DynamoDB
- Amazon S3
- JSON Web Tokens (JWT)

## Project Structure


Each directory inside `/lambdas` contains an isolated AWS Lambda function.

## API Endpoints

### Categories
- `GET /categories`

### Destinations
- `GET /destinations`
- `GET /destinations/{idProvider}`
- `POST /create-destination`
- `PUT /edit-destination`

### Providers
- `GET /providers`

### Users
- `POST /register`
- `POST /login`
- `PUT /edit-user`

## Authentication

Protected routes require a JWT token included in the `Authorization` header:
Authorization: Bearer <token>


## Image Storage

Images are uploaded to Amazon S3.  
The resulting S3 URL is stored in DynamoDB.

## Environment Variables

``` 
JWT_SECRET=
USERS_TABLE=
PROVIDERS_TABLE=
DESTINATIONS_TABLE=
CATEGORIES_TABLE=
S3_BUCKET=
``` 

## Installation

``` 
npm install
```


## Local Execution

```
node src/lambdas/<function>/index.js
```

## Deployment

Deployment is performed using AWS Lambda and API Gateway:

1. Upload the Lambda function packages.
2. Configure the routes in API Gateway.
3. Set the required environment variables.
4. Assign IAM permissions for DynamoDB and S3.

