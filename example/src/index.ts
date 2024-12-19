console.log(process.env.TEST);

export default {
  fetch(request, env) {
    console.log(env);
    return new Response("Hello World");
  },
};
