async function run() {
  const res = await fetch("http://localhost:3000/api/profile/match", {
    headers: {
      "Cookie": "sb-gmhowygqtvfuftumkbzp-auth-token=test"
    }
  });
  console.log(res.status);
  console.log(await res.text());
}
run();
