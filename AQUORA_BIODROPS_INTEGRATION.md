# eDrops – Aquora to Aquzio Biodrops Integration Migration Notice

> [!NOTE]
> This integration has been canonicalized to **Aquzio**.
> Full documentation and transition mappings are maintained in [AQUZIO_BIODROPS_INTEGRATION.md](./AQUZIO_BIODROPS_INTEGRATION.md).

The existing Aquora environment variables and endpoints remain 100% backward compatible:
- `AQUORA_BIODROPS_API_URL` -> Supported as fallback for `AQUZIO_BIODROPS_API_URL`
- `AQUORA_BIODROPS_API_KEY` -> Supported as fallback for `AQUZIO_BIODROPS_API_KEY`
- Legacy routes `/aquora-integration/*` are mapped to `/aquzio-integration/*`

Please refer to `AQUZIO_BIODROPS_INTEGRATION.md` for complete API and architectural details.
