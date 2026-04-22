const BACKEND_SEDES = "https://padbol-backend.onrender.com/api/sedes";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const upstream = await fetch(BACKEND_SEDES);
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: corsHeaders,
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: String(err && err.message ? err.message : err) }),
    };
  }
};
