# wangler

_Evil wrangler. A place for experiments by Sunil. Use at your own caution._

A wrapper around `wrangler`. For the lolz.

As of now, this adds just one feature: it automatically loads environment variables from `.env` files and populates `process.env` in your Cloudflare Workers.

## Why

This is a feature that wrangler will eventually ship, but I wanted it now for my own stuff.

## Installation

```bash
npm install wangler wrangler
```

## Usage

1. Create a `.env` file in your project root:

```env
API_KEY=your-api-key
DATABASE_URL=your-database-url
```

2. Use the `wangler` command instead of `wrangler`:

```bash
npx wangler dev # or wangler deploy
```

3. Reference `process.env` in your code:

```js
console.log(process.env.API_KEY); // your-api-key
```

## Additional features:

- You can pass a path to a custom `.env` file via `--env-file <path>`.

- You can also have environment specific `.env` files. For example, you can have a `.env.dev` file for development and a `.env.prod` file for production. To use, pass `--env <env>` where `<env>` is the name of the environment you want to use. (This works with wrangler's own `--env` flag, where it'll pick bindings and values defined under `[env.<env>]` in `wrangler.toml`)

- You can pass values in the cli via `--penv <value>`. This is useful for passing in arguments defined in your actual environment (like in CI, you can do `npx wangler dev --penv DATABASE_URL:$SUPABASE_URL` to pass in a value for `DATABASE_URL`).

## How it works

This tool wraps the standard Wrangler CLI and automatically converts your `.env` file variables into `--define` arguments that Wrangler understands. It's a drop-in replacement for Wrangler that adds `.env` file support.

## License

MIT
