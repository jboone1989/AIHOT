-- Independent per-model configurations. Existing tables untouched.
CREATE TABLE model_providers (
 vendor text NOT NULL,
 model_id text NOT NULL,
 adapter text NOT NULL CHECK (adapter IN ('chat','embedding','document','safety','special','unconfigured')),
 endpoint text,
 credential_env text NOT NULL CHECK (credential_env ~ '^[A-Z][A-Z0-9_]{1,79}$'),
 capabilities jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities)='array'),
 request_defaults jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(request_defaults)='object'),
 timeout_ms integer NOT NULL DEFAULT 60000 CHECK (timeout_ms BETWEEN 1000 AND 600000),
 stream boolean NOT NULL DEFAULT false,
 complexity text NOT NULL DEFAULT 'medium' CHECK (complexity IN ('light','medium','heavy')),
 documentation_url text,
 notes text,
 enabled boolean NOT NULL DEFAULT false,
 route_enabled boolean NOT NULL DEFAULT false CHECK (NOT route_enabled OR enabled),
 version integer NOT NULL DEFAULT 1,
 updated_by text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (vendor,model_id),
 CHECK (endpoint IS NULL OR endpoint ~ '^https://[a-z0-9.-]+(/[^?#]*)?$')
);
