function authenticate(helper, paramsValues, credentials) {
    print("Starting script authetication...");

    var email = credentials.getParam("email");
    var password = credentials.getParam("password");

    var loginUrl = "https://api.frascoengineer.com/auth/login";
    var requestUri = new java.net.URI(loginUrl);

    var msg = helper.prepareMessage();
    msg.setRequestHeader(
        "POST " + requestUri.getPath() + " HTTP/1.1\r\n" +
        "Host: " + requestUri.getHost() + "\r\n" +
        "Content-Type: application/json\r\n"
    );

    var requestBody = '{"email":"' + email + '", "password":"' + password + '"}';
    msg.setRequestBody(requestBody);
    msg.getRequestHeader().setContentLength(requestBody.length);

    helper.sendAndReceive(msg, true);

    var responseHeader = msg.getResponseHeader().toString();

    var cookieMatch = responseHeader.match(/Set-Cookie:\s*accessToken=([^;]+)/i);

    if (cookieMatch) {
        var token = cookieMatch[1];

        msg.getRequestHeader().setHeader("Cookie", "accessToken=" + token);

        msg.getRequestHeader().setHeader("Authorization", "Bearer " + token);

        print("Script authetication completed");
    } else {
        print("Script authentication failed");
    }

    return msg;
}

function getRequiredParamsNames() {
    return [];
}

function getOptionalParamsNames() {
    return [];
}

function getCredentialsParamsNames() {
    return ["email", "password"];
}
