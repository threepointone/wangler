// we need to declare this because
// import.meta.env is usually a userland thing
declare global {
  interface ImportMeta {
    env: {
      TEST: string;
    };
  }
}

console.log(process.env.TEST);
console.log(import.meta.env.TEST);
console.log(process.env["YET-ANOTHER-TEST"]);

try {
  console.log(process.env.DOES_NOT_EXIST);
} catch (e) {
  console.error(e);
}

export default {
  fetch(request, env) {
    console.log(env);
    return new Response("Hello World");
  },
};
