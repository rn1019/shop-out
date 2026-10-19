export const config = {
    api: {
      bodyParser: false,
    },
  };
  
  export default async function handler(req, res) {
    const path = Array.isArray(req.query.path)
      ? req.query.path.join("/")
      : "";
  
    // Fixed upstream host; user-supplied URLs are never accepted.
    const target = new URL(
      path,
      "https://gateway.streetstylestore.com/"
    );
  
    if (!["POST", "GET", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return res.status(405).send("Method Not Allowed");
    }
  
    try {
      const chunks = [];
  
      for await (const chunk of req) {
        chunks.push(chunk);
      }
  
      const body = Buffer.concat(chunks);
      const headers = {};
  
      if (req.headers["content-type"]) {
        headers["content-type"] = req.headers["content-type"];
      }
  
      if (req.headers["accept"]) {
        headers["accept"] = req.headers["accept"];
      }
  
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body:
          ["GET", "HEAD"].includes(req.method) || body.length === 0
            ? undefined
            : body,
        redirect: "manual",
      });
  
      const responseBody = Buffer.from(await upstream.arrayBuffer());
  
      res.status(upstream.status);
  
      const contentType = upstream.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
  
      return res.send(responseBody);
    } catch (error) {
      console.error("API proxy error:", error.message);
      return res.status(502).json({
        error: "Upstream API request failed",
      });
    }
  }