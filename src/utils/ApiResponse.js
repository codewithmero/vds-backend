class ApiResponse {
    constructor(
        statusCode,
        data,
        message = "Successful response"
    ) {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}