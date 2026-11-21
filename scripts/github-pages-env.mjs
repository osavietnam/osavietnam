export function githubPagesEnvironment(env = process.env) {
  const repository = env.GITHUB_REPOSITORY || 'osavietnam/osavietnam';
  const [owner = 'osavietnam', repo = 'osavietnam'] = repository.split('/');
  const isUserSite = repo.toLowerCase() === `${owner}.github.io`.toLowerCase();
  const site = env.GITHUB_PAGES_SITE || `https://${owner}.github.io`;
  const base = env.GITHUB_PAGES_BASE ?? (isUserSite ? '' : `/${repo}`);
  return { repository, owner, repo, site, base };
}
