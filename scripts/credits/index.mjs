import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const vendored = join(import.meta.dirname, 'licenses');
const repo = 'hackclub/orchard';
const dataFile = join(root, 'apps/landing/src/lib/credits.generated.json');

const COMPONENTS = [
  {
    id: 'web',
    name: 'Web app',
    dir: 'apps/frontend',
    kind: 'sveltekit',
    extra: ['motion', 'tailwindcss']
  },
  { id: 'api', name: 'API server', dir: 'apps/server', kind: 'node', filter: 'server' },
  {
    id: 'cli',
    name: 'CLI',
    dir: 'apps/cli',
    kind: 'go',
    packages: ['.'],
    goos: ['linux', 'darwin', 'windows']
  },
  {
    id: 'provider',
    name: 'Terraform provider',
    dir: 'apps/cli',
    kind: 'go',
    packages: ['./tofu-provider'],
    goos: ['linux', 'darwin', 'windows', 'freebsd']
  },
  { id: 'orchardctl', name: 'orchardctl', dir: 'apps/server/hostctl', kind: 'go', goos: ['linux'] },
  { id: 'gateway', name: 'Gateway', dir: 'apps/gateway', kind: 'go', goos: ['linux'] },
  { id: 'r2-proxy', name: 'R2 proxy', dir: 'apps/r2-proxy', kind: 'go', goos: ['linux'] },
  { id: 'fc-builder', name: 'Fast builder', dir: 'apps/fc-builder', kind: 'go', goos: ['linux'] },
  { id: 'registry', name: 'Template registry', dir: 'apps/registry', kind: 'go', goos: ['linux'] },
  { id: 'docs', name: 'Docs', dir: 'apps/docs', kind: 'astro', extra: ['pagefind'] },
  {
    id: 'site',
    name: 'Website',
    dir: 'apps/landing',
    kind: 'sveltekit',
    extra: ['motion', 'tailwindcss']
  }
];

const NOTICES = [
  {
    file: 'apps/frontend/static/third-party-notices.txt',
    title: 'the Orchard web app',
    in: ['web']
  },
  {
    file: 'apps/server/THIRD_PARTY_NOTICES.txt',
    title: 'the Orchard API server and its images',
    in: ['api', 'orchardctl']
  },
  {
    file: 'apps/cli/internal/notices/THIRD_PARTY_NOTICES.txt',
    title: 'the Orchard CLI',
    in: ['cli']
  },
  {
    file: 'apps/cli/tofu-provider/THIRD_PARTY_NOTICES.txt',
    title: 'the Orchard Terraform provider',
    in: ['provider']
  },
  {
    file: 'apps/server/hostctl/internal/notices/THIRD_PARTY_NOTICES.txt',
    title: 'orchardctl',
    in: ['orchardctl']
  },
  {
    file: 'apps/r2-proxy/THIRD_PARTY_NOTICES.txt',
    title: 'the Orchard R2 proxy',
    in: ['r2-proxy']
  },
  {
    file: 'apps/fc-builder/THIRD_PARTY_NOTICES.txt',
    title: 'the Orchard fast builder',
    in: ['fc-builder']
  },
  {
    file: 'apps/registry/THIRD_PARTY_NOTICES.txt',
    title: 'the Orchard template registry',
    in: ['registry']
  },
  { file: 'apps/docs/public/third-party-notices.txt', title: 'the Orchard docs', in: ['docs'] },
  {
    file: 'apps/landing/static/third-party-notices.txt',
    title: 'every part of Orchard',
    in: COMPONENTS.map((component) => component.id)
  }
];

const FONTS = [
  {
    name: 'Allo',
    file: 'apps/frontend/static/fonts/Allo/OFL.txt',
    url: 'https://allo.joshpuckett.me',
    in: ['web', 'docs', 'site']
  },
  {
    name: 'Plus Jakarta Sans',
    file: 'apps/frontend/static/fonts/Plus_Jakarta_Sans/OFL.txt',
    url: 'https://github.com/tokotype/PlusJakartaSans',
    in: ['web', 'docs', 'site']
  },
  {
    name: 'Space Mono',
    file: 'apps/frontend/static/fonts/Space_Mono/OFL.txt',
    url: 'https://github.com/googlefonts/spacemono',
    in: ['web', 'docs', 'site']
  },
  {
    name: 'JetBrains Mono',
    file: 'apps/frontend/static/fonts/JetBrains_Mono/OFL.txt',
    url: 'https://github.com/JetBrains/JetBrainsMono',
    in: ['web']
  },
  {
    name: 'Atkinson Hyperlegible Next',
    file: 'apps/frontend/static/fonts/Atkinson_Hyperlegible/OFL.txt',
    url: 'https://github.com/googlefonts/atkinson-hyperlegible-next',
    in: ['web']
  },
  {
    name: 'Source Serif 4',
    file: 'apps/frontend/static/fonts/Source_Serif_4/OFL.txt',
    url: 'https://github.com/adobe-fonts/source-serif',
    in: ['web']
  },
  {
    name: 'OpenDyslexic',
    file: 'apps/frontend/static/fonts/OpenDyslexic/OFL.txt',
    url: 'https://opendyslexic.org',
    in: ['web']
  }
];

const VENDORED = [
  {
    name: 'Devicon',
    eco: 'asset',
    note: 'Technology logos',
    file: 'apps/frontend/static/icons/tech/LICENSE',
    url: 'https://github.com/devicons/devicon',
    in: ['web']
  },
  {
    name: 'Railpack',
    eco: 'code',
    note: 'Framework detection rules ported from Railpack',
    file: 'scripts/credits/licenses/railpack.LICENSE',
    url: 'https://github.com/railwayapp/railpack',
    in: ['api']
  }
];

const OVERRIDES = {
  'github.com/mattn/go-localereader': {
    replace: ['go-localereader.LICENSE'],
    why: 'The module ships no license file. This is the MIT license from its repository.'
  },
  '@img/sharp-libvips-*': {
    version: '1.3.4',
    url: 'https://github.com/lovell/sharp-libvips/tree/v1.3.4',
    append: [
      'sharp-libvips.THIRD-PARTY-NOTICES.md',
      'versions.json',
      'LGPL-3.0.txt',
      'GPL-3.0.txt'
    ],
    why:
      'Prebuilt libvips and the libraries listed in THIRD-PARTY-NOTICES.md, which sharp loads as a shared library. ' +
      'The package ships no license text, so the upstream notices, the library versions and the LGPL are included here. ' +
      'Corresponding source: the build recipe at https://github.com/lovell/sharp-libvips/tree/v1.3.4 fetches every library ' +
      'from its upstream release at the versions in versions.json.'
  }
};

const HOLDERS = {
  'caniuse-lite': ['Alexis Deveria and the caniuse.com contributors', 'Ben Briggs'],
  '@sveltejs/kit': ['2020 the SvelteKit contributors'],
  '@img/sharp-libvips-*': ['Lovell Fuller and the libvips contributors']
};

const LICENSE_FILE =
  /^(licen[cs]e|copying|copyright|notice|third[-_ ]?party[-_ ]?notices?)([-._].*)?$/i;
const NOT_TEXT = /\.(c?js|mjs|ts|json|csv|html?|ya?ml)$/i;
const PLATFORM =
  /-(darwin|linux|linuxmusl|win32|freebsd|android)-(arm64|x64|arm|ia32|s390x|ppc64|riscv64)(-(gnu|musl|msvc|gnueabihf))?$/;

function say(line = '') {
  process.stdout.write(`${line}\n`);
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts
  });
}

function walk(dir, test, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, test, found);
    else if (test(path)) found.push(path);
  }
  return found;
}

function packageDirOf(file) {
  const marker = '/node_modules/';
  const at = file.lastIndexOf(marker);
  if (at < 0) return null;
  const [scope, name] = file.slice(at + marker.length).split('/');
  return file.slice(0, at + marker.length) + (scope.startsWith('@') ? `${scope}/${name}` : scope);
}

function sourcemapPackages(mapRoots) {
  const dirs = new Set();
  for (const mapRoot of mapRoots) {
    for (const map of walk(mapRoot, (path) => path.endsWith('.map'))) {
      const { sources = [], sourceRoot = '' } = JSON.parse(readFileSync(map, 'utf8'));
      for (const source of sources) {
        if (!source || source.startsWith('\0')) continue;
        const dir = packageDirOf(resolve(dirname(map), sourceRoot, source));
        if (dir && existsSync(join(dir, 'package.json'))) dirs.add(realpathSync(dir));
      }
    }
  }
  return dirs;
}

function build(cmd, args, cwd, env = process.env) {
  say(`  building ${cwd.slice(root.length + 1)} with sourcemaps`);
  const result = spawnSync(cmd, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  if (result.status !== 0) throw new Error(`build failed in ${cwd}\n${result.stderr}`);
}

function sveltekitPackages(dir) {
  build('pnpm', ['exec', 'vite', 'build', '--sourcemap'], dir);
  const output = join(dir, '.svelte-kit/output');
  const dirs = sourcemapPackages([output]);
  for (const target of [output, join(dir, 'build')]) {
    for (const map of walk(target, (path) => path.endsWith('.map'))) rmSync(map);
  }
  return dirs;
}

function astroPackages(dir) {
  const outDir = join(dir, '.credits-dist');
  const script = `import { build } from 'astro'; await build({ root: '.', outDir: ${JSON.stringify(outDir)}, logLevel: 'error', vite: { build: { sourcemap: true } } });`;
  const hoisted = join(root, 'node_modules/.pnpm/node_modules');
  const nodePath = [hoisted, process.env.NODE_PATH].filter(Boolean).join(delimiter);
  build('node', ['--input-type=module', '-e', script], dir, {
    ...process.env,
    NODE_PATH: nodePath
  });
  const dirs = sourcemapPackages([join(outDir, '_astro')]);
  rmSync(outDir, { recursive: true, force: true });
  return dirs;
}

function prodPackages(filter) {
  const listed = JSON.parse(
    run('pnpm', ['licenses', 'list', '--prod', '--json', '--long', '--filter', filter])
  );
  const dirs = new Set();
  for (const packages of Object.values(listed)) {
    for (const pkg of packages) for (const path of pkg.paths) dirs.add(realpathSync(path));
  }
  return dirs;
}

function findPackage(name, from) {
  for (let dir = from; dir.startsWith(root); dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
  }
  const store = join(root, 'node_modules/.pnpm');
  const prefix = `${name.replace('/', '+')}@`;
  const hits = readdirSync(store)
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => join(store, entry, 'node_modules', name))
    .filter((candidate) => existsSync(join(candidate, 'package.json')))
    .sort();
  return hits.length ? realpathSync(hits.at(-1)) : null;
}

function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').trim();
}

function licenseTexts(dir) {
  const rank = (file) =>
    /third/i.test(file) ? 3 : /notice/i.test(file) ? 2 : /copyright/i.test(file) ? 1 : 0;
  return readdirSync(dir)
    .filter(
      (file) =>
        LICENSE_FILE.test(file) && !NOT_TEXT.test(file) && statSync(join(dir, file)).isFile()
    )
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((file) => ({ file, text: readText(join(dir, file)) }))
    .filter(({ text }) => text.length > 0);
}

function classify(texts) {
  const found = [];
  const add = (id) => !found.includes(id) && found.push(id);
  for (const { text } of texts) {
    const t = text.replace(/\s+/g, ' ');
    const head = t.slice(0, 600);
    if (/SIL OPEN FONT LICENSE/i.test(head)) {
      add('OFL-1.1');
      continue;
    }
    const gnu = head.match(/GNU (AFFERO |LESSER )?GENERAL PUBLIC LICENSE,? Version (\d)/i);
    if (gnu) add(`${gnu[1] ? (/affero/i.test(gnu[1]) ? 'AGPL' : 'LGPL') : 'GPL'}-${gnu[2]}.0`);
    if (/Mozilla Public License,? (v|version)\.? ?2\.0/i.test(head)) add('MPL-2.0');
    if (
      /Apache License,? Version 2\.0/i.test(head) ||
      /Licensed under the Apache License,? Version 2\.0/i.test(t)
    ) {
      add('Apache-2.0');
    }
    if (
      /Permission is hereby granted, free of charge, to any person obtaining a copy of this software/i.test(
        t
      )
    ) {
      add('MIT');
    }
    const isc = t.match(
      /Permission to use, copy, modify, and(\/or)? distribute this software for any purpose with or without fee is hereby granted(, provided that)?/i
    );
    if (isc) add(isc[2] ? 'ISC' : '0BSD');
    if (/Redistribution and use in source and binary forms/i.test(t)) {
      add(
        /Neither the name|may not be used to endorse|may be used to endorse/i.test(t)
          ? 'BSD-3-Clause'
          : 'BSD-2-Clause'
      );
    }
    if (/free and unencumbered software released into the public domain/i.test(t)) add('Unlicense');
    if (/CC0 1\.0 Universal/i.test(t)) add('CC0-1.0');
    if (/Boost Software License/i.test(head)) add('BSL-1.0');
  }
  return found.length ? found.join(' AND ') : null;
}

function readmeLicense(dir) {
  const readme = readdirSync(dir).find((file) => /^readme(\.md|\.markdown|\.txt)?$/i.test(file));
  if (!readme) return null;
  const match = readFileSync(join(dir, readme), 'utf8').match(/^#+\s*licen[cs]e\s*\n+([^\n]+)/im);
  if (!match) return null;
  const line = match[1];
  if (/\bMIT\b/.test(line)) return 'MIT';
  if (/Apache/i.test(line)) return 'Apache-2.0';
  if (/\bISC\b/.test(line)) return 'ISC';
  if (/BSD/.test(line)) return 'BSD-3-Clause';
  return null;
}

function tidyLicense(id) {
  return id
    .replace(/^\((.*)\)$/, '$1')
    .replace(/\bApache2\b/g, 'Apache-2.0')
    .replace(/^MIT \(https?:[^)]*\)$/, 'MIT');
}

function declaredLicense(pkg) {
  let declared = pkg.license ?? pkg.licenses;
  if (Array.isArray(declared)) {
    declared = declared
      .map((entry) => (typeof entry === 'string' ? entry : entry?.type))
      .join(' OR ');
  }
  if (declared && typeof declared === 'object') declared = declared.type;
  if (
    typeof declared !== 'string' ||
    !declared.trim() ||
    /^see licen[cs]e/i.test(declared) ||
    declared === 'UNLICENSED'
  ) {
    return null;
  }
  return tidyLicense(declared.trim());
}

function noticeLine(raw) {
  const line = raw.replace(/^[\s*#/>|-]+/, '').trim();
  const match = line.match(/^(copyright|\(c\)|©)(?:\s*(?:\(c\)|©))*\s*(.*)$/i);
  if (!match) return null;
  const rest = match[2];
  const worded = /^copyright$/i.test(match[1]);
  if (!(/^\d/.test(rest) || (worded && (/^[A-Z]/.test(rest) || /held by/.test(rest))))) return null;
  if (/^(licen[cs]e|notices?|holders?|owners?|statement|law)\b/i.test(rest)) return null;
  if (
    /<(year|name|owner|copyright)|\[(yyyy|year|name|fullname|owner)|\{(yyyy|year|name)|\byyyy\b/i.test(
      line
    )
  ) {
    return null;
  }
  return rest;
}

function holdersIn(rest) {
  if (/held by/.test(rest)) {
    return [...rest.matchAll(/held by ([^.(]+?)(?:\s+as part of [^.]*)?(?:\.|\(|$)/g)].map(
      (match) => match[1].trim()
    );
  }
  return [
    rest
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\s*<[^>]*>/g, '')
      .replace(/\s*\((https?:\/\/|mailto:|www\.)[^)]*\)/gi, '')
      .replace(/all rights reserved\.?/i, '')
      .replace(/\bthese people\b/, 'contributors')
      .replace(/[,;:\s]+$/, '')
      .replace(/(?<!\b(?:Inc|Ltd|Corp|Co|B\.V|N\.V|S\.A|e\.V|L\.P|Jr|Sr))\.+$/, '')
      .trim()
  ];
}

function holders(texts) {
  const found = [];
  for (const { text } of texts) {
    for (const raw of text.split('\n')) {
      const rest = noticeLine(raw);
      if (!rest) continue;
      for (const name of holdersIn(rest)) {
        if (
          name.length < 2 ||
          name.length > 160 ||
          /Free Software Foundation|Creative Commons/i.test(name)
        ) {
          continue;
        }
        if (!found.includes(name)) found.push(name);
      }
    }
  }
  return found.slice(0, 4);
}

function githubOwner(url) {
  return url.match(/^https:\/\/github\.com\/([^/]+)/)?.[1] ?? null;
}

function personName(person) {
  if (!person) return null;
  if (typeof person === 'string') {
    return (
      person
        .replace(/\s*<[^>]*>/, '')
        .replace(/\s*\([^)]*\)/, '')
        .trim() || null
    );
  }
  return person.name ?? null;
}

function validUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href.replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

function repoUrl(pkg) {
  let url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  if (url) {
    url = url
      .replace(/^git\+/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/^ssh:\/\/git@/, 'https://')
      .replace(/^git@([^:]+):/, 'https://$1/')
      .replace(/^(https?:\/\/[^/:]+):(?!\d)/, '$1/')
      .replace(/\.git$/, '');
    if (url.startsWith('github:')) url = `https://github.com/${url.slice(7)}`;
    if (/^[\w.-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
    const link = validUrl(url);
    if (link) return link;
  }
  const home = typeof pkg.homepage === 'string' ? validUrl(pkg.homepage) : null;
  return home ?? `https://www.npmjs.com/package/${pkg.name}`;
}

function tarballUrl(name, version) {
  return `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`;
}

function moduleZipUrl(path, version) {
  const escape = (value) => value.replace(/[A-Z]/g, (letter) => `!${letter.toLowerCase()}`);
  return `https://proxy.golang.org/${escape(path)}/@v/${escape(version)}.zip`;
}

function applyOverride(entry, dir) {
  const override = OVERRIDES[entry.name];
  if (!override) return entry;
  if (override.version && override.version !== entry.version) {
    console.warn(
      `  ${entry.name} is ${entry.version} but the vendored notices are for ${override.version}; refresh scripts/credits/licenses`
    );
  }
  const vendoredText = (file) => {
    const local = dir && existsSync(join(dir, file)) ? join(dir, file) : join(vendored, file);
    return { file, text: readText(local) };
  };
  const texts = override.replace
    ? override.replace.map(vendoredText)
    : [...entry.texts, ...(override.append ?? []).map(vendoredText)];
  return { ...entry, texts, note: override.why, url: override.url ?? entry.url };
}

function describeNpm(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const texts = licenseTexts(dir);
  const found = classify(texts);
  const declaredId = declaredLicense(pkg);
  const conflict = declaredId && found && disagrees({ eco: 'npm', license: declaredId, found });
  const license = conflict ? found : (declaredId ?? found ?? readmeLicense(dir) ?? 'UNKNOWN');
  const url = repoUrl(pkg);
  const name = pkg.name.replace(PLATFORM, '-*');
  const fallback =
    personName(pkg.author) ??
    personName(pkg.maintainers?.[0]) ??
    githubOwner(url) ??
    pkg.name.match(/^@([^/]+)\//)?.[1] ??
    null;
  const by = HOLDERS[name] ?? holders(texts);
  return applyOverride(
    {
      eco: 'npm',
      source: pkg.name,
      name,
      version: pkg.version,
      license,
      found,
      by: by.length ? by : fallback ? [fallback] : [],
      url,
      archive: name.includes('*') ? null : tarballUrl(pkg.name, pkg.version),
      ...(conflict
        ? {
            conflict: declaredId,
            note: `The package.json says ${declaredId}, but the license file it ships is ${found}, so this entry follows ${found}.`
          }
        : {}),
      texts
    },
    dir
  );
}

function goUrl(path) {
  const parts = path.split('/');
  if (parts[0] === 'github.com' && parts.length >= 3) {
    return `https://github.com/${parts[1]}/${parts[2]}`;
  }
  return `https://pkg.go.dev/${path}`;
}

function goModules(component) {
  const found = new Map();
  const cwd = join(root, component.dir);
  for (const goos of component.goos) {
    const listed = run(
      'go',
      [
        'list',
        '-deps',
        '-f',
        '{{with .Module}}{{if not .Main}}{{.Path}} {{.Version}}{{end}}{{end}}',
        ...(component.packages ?? ['./...'])
      ],
      { cwd, env: { ...process.env, GOOS: goos, CGO_ENABLED: '0' } }
    );
    for (const line of listed.split('\n').filter(Boolean)) {
      const [path, version] = line.split(' ');
      found.set(`${path}@${version}`, { path, version });
    }
  }
  return [...found.values()].map(({ path, version }) => {
    const { Dir } = JSON.parse(
      run('go', ['mod', 'download', '-json', `${path}@${version}`], { cwd })
    );
    const texts = licenseTexts(Dir);
    const by = holders(texts);
    return applyOverride(
      {
        eco: 'go',
        name: path,
        version,
        license: classify(texts) ?? readmeLicense(Dir) ?? 'UNKNOWN',
        by: by.length ? by : [path.split('/')[1] ?? path],
        url: goUrl(path),
        archive: moduleZipUrl(path, version),
        texts
      },
      null
    );
  });
}

function goStdlib(cwd) {
  const opts = { cwd, env: { ...process.env, GOTOOLCHAIN: 'auto' } };
  const goroot = run('go', ['env', 'GOROOT'], opts).trim();
  const version = run('go', ['env', 'GOVERSION'], opts).trim().replace(/^go/, '');
  const bundled = licenseTexts(goroot);
  const texts = bundled.length
    ? bundled
    : [{ file: 'LICENSE', text: readText(join(vendored, 'go.LICENSE')) }];
  return {
    eco: 'go',
    name: 'Go standard library',
    version,
    license: classify(texts) ?? 'BSD-3-Clause',
    by: holders(texts),
    url: 'https://go.dev',
    archive: `https://go.dev/dl/go${version}.src.tar.gz`,
    texts
  };
}

function fromFile(entry, eco) {
  const texts = [{ file: entry.file.split('/').at(-1), text: readText(join(root, entry.file)) }];
  return {
    eco,
    name: entry.name,
    version: '',
    license: classify(texts) ?? 'UNKNOWN',
    by: holders(texts),
    url: entry.url,
    note: entry.note,
    texts
  };
}

function githubName(login) {
  try {
    return run('gh', ['api', `users/${login}`, '--jq', '.name // ""']).trim() || login;
  } catch {
    return login;
  }
}

function contributors(previous) {
  try {
    const people = new Map();
    for (const person of JSON.parse(
      run('gh', ['api', `repos/${repo}/contributors?per_page=100`])
    )) {
      if (person.type === 'User') {
        people.set(person.login.toLowerCase(), {
          login: person.login,
          commits: person.contributions
        });
      }
    }
    for (const email of run('git', ['log', 'HEAD', '--format=%ae']).split('\n')) {
      const match = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.(?:com|invalid)$/i);
      if (!match || match[1].endsWith('[bot]')) continue;
      const key = match[1].toLowerCase();
      const person = people.get(key) ?? { login: match[1], commits: 0, counted: true };
      if (person.counted) person.commits++;
      people.set(key, person);
    }
    return [...people.values()]
      .sort((a, b) => b.commits - a.commits)
      .map(({ login, commits }) => ({ login, name: githubName(login), commits }));
  } catch {
    console.warn('  gh unavailable, keeping the previous contributor list');
    return previous;
  }
}

function hash(text) {
  return createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex');
}

function splitNotice(text) {
  const notice = [];
  const body = [];
  for (const raw of text.split('\n')) (noticeLine(raw) ? notice : body).push(raw);
  return { notice: notice.map((line) => line.trim()), body: body.join('\n').trim() };
}

function notices(entries, target, names) {
  const rule = '='.repeat(80);
  const out = [
    'THIRD-PARTY NOTICES',
    '',
    `This file covers ${target.title}.`,
    '',
    'Orchard is free software under the GNU Affero General Public License v3.0.',
    `Its source code and license live at https://github.com/${repo}.`,
    '',
    'Orchard includes the open-source software listed below. Each entry names',
    'where its source code lives, its copyright notices, and the license text it',
    'came with. Many packages share a license word for word apart from the',
    'copyright line, so each license body is printed in full once and later',
    'entries point back to it.',
    '',
    'Generated by scripts/credits.'
  ];
  const printed = new Map();
  for (const entry of entries) {
    const title = entry.version ? `${entry.name} ${entry.version}` : entry.name;
    out.push('', rule, title);
    if (target.in.length > 1) out.push(`Ships in: ${entry.in.map((id) => names[id]).join(', ')}`);
    out.push(`Project: ${entry.url}`);
    if (entry.archive) out.push(`Source for this version: ${entry.archive}`);
    out.push(`License: ${entry.license}`);
    if (entry.note) out.push(`Note: ${entry.note}`);
    out.push('');
    if (!entry.texts.length) {
      out.push(
        `No license file ships with this package. It declares ${entry.license} in its ${entry.eco === 'go' ? 'README' : 'package.json'}.`
      );
      if (entry.by.length) out.push(...entry.by.map((name) => `Copyright ${name}`));
      continue;
    }
    for (const { file, text } of entry.texts) {
      const { notice, body } = splitNotice(text);
      const key = hash(body);
      const first = printed.get(key);
      if (body && first && first !== title) {
        out.push(
          ...notice,
          `The rest of ${file} is word for word the text printed under ${first}.`,
          ''
        );
        continue;
      }
      if (body) printed.set(key, title);
      if (entry.texts.length > 1) out.push(`[${file}]`);
      out.push(text, '');
    }
  }
  return `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

function declared(component) {
  const dir = join(root, component.dir);
  if (component.kind === 'go') {
    const mod = readFileSync(join(dir, 'go.mod'), 'utf8');
    return new Set(
      [...mod.matchAll(/^\s*(?:require\s+)?(\S+)\s+(v\S+)([^\n]*)$/gm)]
        .filter((match) => match[1].includes('.') && !match[3].includes('// indirect'))
        .map((match) => match[1])
    );
  }
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...(component.extra ?? [])
  ]);
}

function disagrees(entry) {
  if (entry.eco !== 'npm' || !entry.found || entry.license === 'UNKNOWN') return false;
  const said = entry.license.split(/\s+(?:OR|AND)\s+|[()]/).filter(Boolean);
  return !entry.found
    .split(' AND ')
    .some((id) => said.some((declaredId) => declaredId.startsWith(id.split('-')[0])));
}

const previous = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : { people: [] };
const entries = new Map();
const order = Object.fromEntries(COMPONENTS.map((component, index) => [component.id, index]));
const names = Object.fromEntries(COMPONENTS.map((component) => [component.id, component.name]));

function add(entry, component, direct) {
  const key = `${entry.eco}:${entry.name}@${entry.version}`;
  const existing = entries.get(key) ?? { ...entry, in: [], direct: false };
  if (!existing.in.includes(component)) existing.in.push(component);
  existing.direct ||= direct;
  entries.set(key, existing);
}

function sortedEntries() {
  return [...entries.values()]
    .map((entry) => ({ ...entry, in: entry.in.toSorted((a, b) => order[a] - order[b]) }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
        a.version.localeCompare(b.version, 'en', { numeric: true })
    );
}

function emit(people) {
  const sorted = sortedEntries();
  const grouped = new Map();
  for (const entry of sorted) {
    const key = `${entry.eco}:${entry.name}:${entry.license}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.versions.push(entry.version);
      existing.direct ||= entry.direct;
      for (const id of entry.in) if (!existing.in.includes(id)) existing.in.push(id);
      for (const name of entry.by) {
        if (!existing.by.includes(name) && existing.by.length < 4) existing.by.push(name);
      }
      existing.in.sort((a, b) => order[a] - order[b]);
      continue;
    }
    grouped.set(key, {
      name: entry.name,
      versions: entry.version ? [entry.version] : [],
      license: entry.license,
      by: [...entry.by],
      url: entry.url,
      eco: entry.eco,
      direct: entry.direct,
      ...(entry.note ? { note: entry.note } : {}),
      in: [...entry.in]
    });
  }
  const packages = [...grouped.values()];
  const licenses = {};
  for (const pkg of packages) licenses[pkg.license] = (licenses[pkg.license] ?? 0) + 1;
  const data = {
    generated: new Date().toISOString().slice(0, 10),
    components: COMPONENTS.map(({ id, name }) => ({
      id,
      name,
      count: packages.filter((pkg) => pkg.in.includes(id)).length
    })),
    people,
    licenses: Object.entries(licenses).sort((a, b) => b[1] - a[1]),
    packages
  };
  writeFileSync(dataFile, `${JSON.stringify(data)}\n`);
  for (const target of NOTICES) {
    const file = join(root, target.file);
    mkdirSync(dirname(file), { recursive: true });
    const scoped = sorted
      .filter((entry) => entry.in.some((id) => target.in.includes(id)))
      .map((entry) => ({ ...entry, in: entry.in.filter((id) => target.in.includes(id)) }));
    writeFileSync(file, notices(scoped, target, names));
  }
  return { data, sorted };
}

const people = contributors(previous.people ?? []);
for (const font of FONTS) for (const id of font.in) add(fromFile(font, 'font'), id, true);
for (const item of VENDORED) for (const id of item.in) add(fromFile(item, item.eco), id, true);

for (const component of COMPONENTS) {
  say(component.name);
  const dir = join(root, component.dir);
  if (component.id === 'site') emit(people);
  let found = [];
  if (component.kind === 'go') {
    found = [goStdlib(dir), ...goModules(component)];
  } else {
    const dirs =
      component.kind === 'sveltekit'
        ? sveltekitPackages(dir)
        : component.kind === 'astro'
          ? astroPackages(dir)
          : prodPackages(component.filter);
    for (const name of component.extra ?? []) {
      const extra = findPackage(name, dir);
      if (extra) dirs.add(extra);
      else console.warn(`  could not find ${name}`);
    }
    found = [...dirs].map(describeNpm);
  }
  const picked = declared(component);
  for (const entry of found) {
    add(
      entry,
      component.id,
      entry.name === 'Go standard library' || picked.has(entry.source ?? entry.name)
    );
  }
  say(`  ${new Set(found.map((entry) => `${entry.name}@${entry.version}`)).size} packages`);
}

const { data, sorted } = emit(people);
const unknown = data.packages.filter((pkg) => pkg.license === 'UNKNOWN');
const strong = data.packages.filter(
  (pkg) =>
    /\bGPL|AGPL|SSPL|BUSL|Elastic|Commons Clause|CC-BY-NC|CC-BY-SA|EPL|CDDL|JSON\b/i.test(
      pkg.license
    ) && !/LGPL/.test(pkg.license)
);
const weak = data.packages.filter((pkg) => /LGPL|MPL/.test(pkg.license));
const mismatched = sorted.filter((entry) => entry.conflict);
say(`\n${data.packages.length} packages, ${data.licenses.length} licenses`);
for (const [id, count] of data.licenses) say(`  ${String(count).padStart(4)}  ${id}`);
if (unknown.length) say(`\nno license found: ${unknown.map((pkg) => pkg.name).join(', ')}`);
if (strong.length) {
  say(`\nstrong copyleft: ${strong.map((pkg) => `${pkg.name} (${pkg.license})`).join(', ')}`);
}
if (weak.length) {
  say(`\nweak copyleft: ${weak.map((pkg) => `${pkg.name} (${pkg.license})`).join(', ')}`);
}
if (mismatched.length) {
  say(
    `\nlicense file disagrees with the manifest, following the file: ${mismatched.map((entry) => `${entry.name}@${entry.version} (says ${entry.conflict}, ships ${entry.license})`).join(', ')}`
  );
}
