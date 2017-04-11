# RequestBin cURL

Generate [cURL](https://curl.haxx.se/) commands for [RequestBin](http://requestb.in) captured requests to easily replay them. Just copy+paste the URL!

```bash
node requestbinCurl.js http://requestb.in/1234asdf
```

-----

Often [RequestBin](http://requestb.in) is used to capture requests that can not be made directly to a locally-running server during development. For example, you may want to test how your server responds to a webhook request from a 3rd party service without having to make your server publicly accessible. However, there is no easy way to replay the request captured by RequestBin to your server. Enter **RequestBin cURL**.

**RequestBin cURL** allows you to simply copy and paste the URL of a given RequestBin from your browser and it will generate the cURL command to make the same request. You can then modify this command to send the request anywhere you want (like `localhost`!)


## Usage
```bash
node requestbinCurl.js http://requestb.in/1234asdf?inspect
node requestbinCurl.js http://requestb.in/1234asdf?inspect#13mgnv -p
node requestbinCurl.js requestb.in/1234asdf
```

- First arg is the RequestBin URL. Protocol, query string params, port, etc. are ignored and optional.
- Use `-p` to pretty-print the cURL command on multiple lines.
- You can specify a request ID using an anchor tag. You can generate this URL by clicking on the little blue link icon in the top-right corner of any request on [requestb.in](http://requestb.in).
- If you do not specify a request ID, the most recent request from the RequestBin is used.
