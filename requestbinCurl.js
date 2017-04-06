const usageStr =
`USAGE:
node requestbinCurl.js http://requestb.in/1234asdf?inspect
node requestbinCurl.js http://requestb.in/1234asdf?inspect#13mgnv -p
node requestbinCurl.js requestb.in/1234asdf`;


const http = require('http');

// get the url form the command line arguments
const url         = process.argv[2];
const prettyPrint = process.argv[3] === '-p';

if (!url) {
  console.error(usageStr);
  return process.exit(1);
}

// parse the URL
const result = parseRBUrl(url);
if (!result || !result.rbBinId) {
  console.error('Unrecognized RequestBin URL.');
  return process.exit(1);
}

const {rbBinId, rbRequestId} = result;

// get a RequestBin request based on the params parsed from the URL
getTargetedRBRequest(rbBinId, rbRequestId, (fatalErr, err, rbRequest) => {
  if (fatalErr) throw fatalErr;
  if (err) {
    console.error(err.message);
    return process.exit(1);
  }
  
  if (!rbRequest) {
    console.error('');
  }
  
  // convert the RequestBin request into a curl command
  const curlCommand = createCurlCommandFromRBRequest(rbRequest, prettyPrint);
  
  console.log(curlCommand);
  return process.exit(0);
});




function parseRBUrl(rbUrl) {
  const regexPattern =
  '^\\s*'         + // start of string with optional leading whitespace
  '(https?://)?'  + // optional http(s) protocol
  '(www\\.)?'     + // optional www subdomain
  'requestb\\.in' + // domain
  '(:\\d+)?'      + // optional port
  '/(.+?)'        + // path
  '(\\?.*?)?'     + // optional query string params
  '(#(.*?))?'     + // optional anchor
  '\\s*$';          // end of string with optional trailing whitespace
  
  const regexFlags = 'i'; // ignore case (eh, why not?)
  const regex = new RegExp(regexPattern, regexFlags);
  
  const result = regex.exec(rbUrl);
  if (!result) {
    return null;
  }
  
  const encodedRBBinId     = result[4];
  const encodedRBRequestId = result[7];
  
  const rbBinId     = encodedRBBinId    ? decodeURIComponent(encodedRBBinId    ) : null;
  const rbRequestId = encodedRBRequestId? decodeURIComponent(encodedRBRequestId) : null;
  
  return {
    rbBinId,
    rbRequestId
  };
}

function getTargetedRBRequest(rbBinId, rbRequestId, cb) {
  // get either the RequestBin request with the given ID or the latest request from the bin
  if (rbRequestId) {
    return getRBRequest(rbBinId, rbRequestId, (fatalErr, err, rbRequest) => {
      return cb(fatalErr, err, rbRequest);
    });
  }
  else {
    return getRBBinRequests(rbBinId, (fatalErr, err, rbRequests) => {
      if (fatalErr) return cb(fatalErr);
      if (err) return cb(null, err);
      
      if (rbRequests.length === 0) {
        return cb(null, new Error('No RequestBin requests exist in bin with ID "' + rbBinId + '".'));
      }
      
      // get the newest/latest/most recent RequestBin request
      let latestRBRequest = rbRequests[0];
      for (let i = 0; i < rbRequests.length; ++i) {
        const rbRequest = rbRequests[i];
        
        if (rbRequest.time > latestRBRequest.time) {
          latestRBRequest = rbRequest;
        }
      }
      
      return cb(null, null, latestRBRequest);
    });
  }
}

function getRBBinRequests(rbBinId, cb) {
  const endpoint = `/bins/${rbBinId}/requests`;
  callRBAPI(endpoint, (err, result) => {
    if (err) return cb(err);
    if (result.res.statusCode !== 200 || !Array.isArray(result.body)) {
      return cb(null, new Error(`Unrecognized response from RequestBin API.\nURL: ${result.url}\nStatus: ${result.res.statusCode}\n${result.bodyStr}`));
    }
    
    const rbRequests = result.body;
    return cb(null, null, rbRequests);
  });
}

function getRBRequest(rbBinId, rbRequestId, cb) {
  let endpoint = `/bins/${rbBinId}/requests/${rbRequestId}`;
  callRBAPI(endpoint, (err, result) => {
    if (err) return cb(err);
    if (result.res.statusCode !== 200 || typeof result.body !== 'object' || result.body === null || Array.isArray(result.body)) {
      return cb(null, new Error(`Unrecognized response from RequestBin API.\nURL: ${result.url}\nStatus: ${result.res.statusCode}\n${result.bodyStr}`));
    }
    
    let rbRequest = result.body;
    return cb(null, null, rbRequest);
  });
}
  
function callRBAPI(endpoint, cb) {
  const url = `http://requestb.in/api/v1${endpoint}`;
  const req = http.get(url, res => {
    res.setEncoding('utf8');
    
    let bodyStr = '';
    res.on('data', chunk => bodyStr += chunk);
    res.on('end', () => {
      let body = null;
      try {
        body = JSON.parse(bodyStr);
      }
      catch(err) {}
      
      return cb(null, {
        url,
        res,
        bodyStr,
        body
      });
    });
  });
  req.on('error', err => {
    return cb(err);
  });
}

function createCurlCommandFromRBRequest(rbRequest, prettyPrint) {
  const args = [];
  
  // set the method
  args.push('-X ' + escapeShellArg(rbRequest.method));
  
  // set the headers
  for (let headerName in rbRequest.headers) {
    const headerVal = rbRequest.headers[headerName];
    args.push('-H ' + escapeShellArg(headerName + ': ' + headerVal));
  }
  
  // set the body
  args.push('-d ' + escapeShellArg(rbRequest.raw));
  
  // set query string param part of the URL
  let qsParamsStr = createQSParamsStr(rbRequest.query_string);
  let url = qsParamsStr;
  
  args.push(escapeShellArg(url));
  
  // create the cURL command
  const sepStr = prettyPrint? ' \\\n  ' : ' ';
  const curlCommand = 'curl' + sepStr + args.join(sepStr);
  
  return curlCommand;
}

function createQSParamsStr(qsParamMap) {
  let qsParamsStr = '';
  
  for (let qsParamName in qsParamMap) {
    const qsParamVal = qsParamMap[qsParamName];
    
    if (qsParamsStr.length === 0) {
      qsParamsStr += '?';
    }
    else {
      qsParamsStr += '&';
    }
    
    // RequestBin decodes the query string params (gumble grumble...) so we need to re-encode them
    qsParamsStr += encodeURIComponent(qsParamName) + '=' + encodeURIComponent(qsParamVal);
  }
  
  return qsParamsStr;
}

function escapeShellArg(str) {
  return '\'' + str.replace(/'/g, '\'\\\'\'') + '\''; // replace ' with '\\''
}