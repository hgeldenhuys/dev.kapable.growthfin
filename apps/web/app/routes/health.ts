export async function loader() {
  return new Response(JSON.stringify({ status: 'ok', service: 'growthfin-web' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
