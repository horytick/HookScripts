function hook_okhttp3(classLoader) {
    Java.perform(function () {

        var ByteString = classLoader.use("com.android.okhttp.okio.ByteString");
        var Buffer = classLoader.use("okio.Buffer");
        var Interceptor = classLoader.use("okhttp3.Interceptor");
        var Charset = classLoader.use("java.nio.charset.Charset");

        var UTF8 = Charset.forName("UTF-8");

        var MyInterceptor = Java.registerClass({
            name: "okhttp3.MyInterceptor",
            implements: [Interceptor],
            methods: {
                intercept: function (chain) {
                    var request = chain.request();
                    try {
                        console.log("--> " + request.method() +" " + request.url())
                        // console.log("MyInterceptor.intercept onEnter:", request, "\nrequest headers:\n", request.headers());
                        var requestBody = request.body();

                        if (requestBody) {
                            if (requestBody.contentType())
                                console.log("Content-Type: " + requestBody.contentType());
                            if (requestBody.contentLength() != -1)
                                console.log("Content-Length: " + requestBody.contentLength());
                        } 
                        var headers = request.headers()
                        for (let i =0, count=headers.size(); i< count; i++) {
                            var name = headers.name(i)
                            if ("content-type" !== name.toLowerCase() && "content-length" !== name.toLowerCase()){
                                console.log(name + ":" + headers.value(i));
                            }
                        }
                        if(!requestBody){
                            console.log("--> END " + request.method())
                        } else if (bodyHasUnknownEncoding(request.headers())){
                            console.log("--> END " + request.method() + " (encoded body omitted")
                        } else {
                            
                            var BufferObj = Buffer.$new();
                            requestBody.writeTo(BufferObj);
                            var charset = UTF8
                            var contentType = requestBody.contentType();
                            if (contentType !== null){
                                charset = contentType.charset(UTF8);
                            }

                            console.log("")
                            if (isPlaintext(BufferObj, classLoader)){
                                try {
                                console.log(BufferObj.readString(charset));
                                } catch (error) {
                                    console.log(ByteString.of(BufferObj.readByteArray()).hex())
                                }
                                console.log("--> END " + request.method() + " (" + requestBody.contentLength() + "-byte body)");
                            } else {
                                console.log("--> END " + request.method() + " (binary "
                                + requestBody.contentLength() + "-byte body omitted)");
                            }
                        }
                    } catch (error) {
                        console.log("error 2:", error);
                    }


                    var response = chain.proceed(request);
                    try {
                        var responseBody = response.body();
                        var contentLength = responseBody.contentLength();
                        var bodySize = contentLength != -1 ? contentLength + "-byte" : "unknown-length";
                        var message = response.message() ? response.message() : ""
                        console.log("<-- " + response.code() + message + " " + response.request().url()
                            + "  (" + bodySize + " body)") 

                        var myheaders = response.headers()

                        for (let i =0 , count = myheaders.size(); i< count; i++){
                            console.log(myheaders.name(i)+": "+myheaders.value(i));
                        }

                        var HttpHeaders = classLoader.use("okhttp3.internal.http.HttpHeaders")
                        if (!HttpHeaders.hasBody(response)) {
                            console.log(TAG, "<-- END HTTP");
                        } else if (bodyHasUnknownEncoding(response.headers())) {
                            console.log("<-- END HTTP (encoded body omitted)");
                        } else {
                            var source = responseBody.source()
                            var Long = classLoader.use("java.lang.Long")
                            source.request(Long.MAX_VALUE.value)
                            var bufferObj = source.buffer();

                            var gzippedLength = null;
                            if (myheaders.get("Content-Encoding") && (myheaders.get("Content-Encoding")).toLowerCase() == "gzip") {
                                gzippedLength = bufferObj.size();
                                var GzipSource = classLoader.use("okio.GzipSource");
                                var gzippedResponseBody = null;
                                try {
                                    gzippedResponseBody = GzipSource.$new(bufferObj.clone());
                                    var bufferObj = Buffer.$new();
                                    bufferObj.writeAll(gzippedResponseBody);
                                } finally {
                                    if (gzippedResponseBody != null) {
                                        gzippedResponseBody.close();
                                    }
                                }
                            }
                            var charset = UTF8;
                            var contentType = responseBody.contentType();
                            if(!contentType){
                                charset = contentType.charset(UTF8)
                            }

                            if (!isPlaintext(bufferObj, classLoader)){
                                console.log("")
                                console.log("<-- END HTTP (binary " + bufferObj.size() + "-byte body omitted)");
                                return response;
                            } 

                            if (contentLength !== 0){
                                console.log("")
                                try {
                                    console.log(bufferObj.readString(charset))
                                } catch (error){
                                    try{
                                        console.log(ByteString.of(bufferObj.readByteArray()).hex())
                                    } catch (error){
                                        console.log("error 4:", error)
                                    }
                                }
                            }

                            if (gzippedLength !== null){
                                console.log("<-- END HTTP (" + bufferObj.size() + "-byte, "
                                + gzippedLength + "-gzipped-byte body)");
                            } else {
                                console.log("<-- END HTTP (" + bufferObj.size() + "-byte body)");
                            }
                        }
                            
                    } catch (error) {
                        console.log("error 3:", error);
                    }
                    return response;
                }
            }
        });
        var ArrayList = classLoader.use("java.util.ArrayList");
        var OkHttpClient = classLoader.use("okhttp3.OkHttpClient");
        // console.log(OkHttpClient);
        OkHttpClient.$init.overload('okhttp3.OkHttpClient$Builder').implementation = function (Builder) {
            console.log("OkHttpClient.$init:", this, Java.cast(Builder.interceptors(), ArrayList));
            this.$init(Builder);
        };
 
        var MyInterceptorObj = MyInterceptor.$new();
        var Builder = classLoader.use("okhttp3.OkHttpClient$Builder");
        // console.log(Builder);
        Builder.build.implementation = function () {
            this.interceptors().clear();
            //var MyInterceptorObj = MyInterceptor.$new();
            this.interceptors().add(MyInterceptorObj);
            var result = this.build();
            return result;
        };
 
        Builder.build.implementation = function (interceptor) {
            this.networkInterceptors().add(MyInterceptorObj);
            return this.build();
        };
 
        console.log("hook_okhttp3...");
    });
}

function bodyHasUnknownEncoding(myheaders){
    var contentEncoding = myheaders.get("Content-Encoding");
    if (!contentEncoding){
        return false;
    } else {
        if (contentEncoding.toLowerCase()!=="identity" && contentEncoding.toLowerCase()!=="gzip") {
            return true;
        }
        else {
            return false;
        }
    }
}
function isPlaintext(BufferObj, classLoader) {
    var result = false;
    Java.perform(function() {
        try{
            var Buffer = classLoader.use("okio.Buffer")
            var Character = classLoader.use("java.lang.Character")
            var prefix = Buffer.$new();
            var byteCount = BufferObj.size() < 64? BufferObj.size() : 64
            BufferObj.copyTo(prefix, 0, byteCount)
            for (var i = 0; i< 16; i++){
                if (prefix.exhausted()){
                    break;
                } 
                var codePoint = prefix.readUtf8CodePoint()
                if (Character.isISOControl(codePoint) && !Character.isWhitespace(codePoint)) {
                    result =  false;
                }
            }
            result =  true;
        } catch (error){
            console.log("error: ", error)
            result =  false;
        }
    })
    return result;
}

Java.perform(function() {
    var application = Java.use("android.app.Application");
    application.attach.overload('android.content.Context').implementation = function(context) {
        var result = this.attach(context); // 先执行原来的attach方法
        var classloader = context.getClassLoader(); // 获取classloader
        Java.classFactory.loader = classloader;
        hook_okhttp3(Java.classFactory);
    }
 
});