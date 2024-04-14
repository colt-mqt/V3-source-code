let a = 1;
let s = new Set([a]);

[...s].forEach((item) => {
  s.delete(item);
  s.add(item);
  console.log("kill");
});
