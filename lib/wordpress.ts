import { cache } from "react";

const WORDPRESS_ENDPOINT_ENV_KEYS = [
  "WORDPRESS_GRAPHQL_API_URL",
  "WORDPRESS_API_URL",
  "NEXT_PUBLIC_WORDPRESS_API_URL"
] as const;

// 데이터 종류별 Next.js Data Cache revalidate 주기(초)
const REVALIDATE_SECONDS = {
  post: 300,
  posts: 300,
  postsByCategory: 300
} as const;

type GraphQLError = {
  message: string;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLError[];
};

type WordPressCategoryNode = {
  name?: string | null;
  slug?: string | null;
};

type WordPressFeaturedImageNode = {
  node?: {
    sourceUrl?: string | null;
    altText?: string | null;
  } | null;
};

type WordPressPostNode = {
  databaseId?: number | null;
  title?: string | null;
  slug?: string | null;
  uri?: string | null;
  date?: string | null;
  modified?: string | null;
  excerpt?: string | null;
  content?: string | null;
  author?: {
    node?: {
      name?: string | null;
    } | null;
  } | null;
  categories?: {
    nodes?: WordPressCategoryNode[] | null;
  } | null;
  featuredImage?: WordPressFeaturedImageNode | null;
};

type PostsQueryData = {
  posts?: {
    nodes?: WordPressPostNode[] | null;
  } | null;
};

type PostQueryData = {
  post?: WordPressPostNode | null;
};

export type BlogPostSummary = {
  id: number;
  title: string;
  slug: string;
  uri: string;
  date: string | null;
  modified: string | null;
  excerpt: string;
  author: string;
  categories: {
    name: string;
    slug: string;
  }[];
  featuredImage?: {
    sourceUrl: string;
    altText: string;
  } | null;
};

export type BlogPost = BlogPostSummary & {
  content: string;
};

const POSTS_QUERY = `
  query BlogPosts($first: Int!) {
    posts(first: $first, where: { orderby: { field: DATE, order: DESC } }) {
      nodes {
        databaseId
        title
        slug
        uri
        date
        modified
        excerpt
        author {
          node {
            name
          }
        }
        categories(first: 8) {
          nodes {
            name
            slug
          }
        }
      }
    }
  }
`;

const POST_BY_SLUG_QUERY = `
  query BlogPostBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      databaseId
      title
      slug
      uri
      date
      modified
      excerpt
      content
      author {
        node {
          name
        }
      }
      categories(first: 8) {
        nodes {
          name
          slug
        }
      }
    }
  }
`;

function getWordPressEndpoint() {
  const endpoint = WORDPRESS_ENDPOINT_ENV_KEYS.map((key) => process.env[key]).find(Boolean);

  if (!endpoint) {
    throw new Error(
      `Missing WordPress GraphQL endpoint. Set one of: ${WORDPRESS_ENDPOINT_ENV_KEYS.join(", ")}`
    );
  }

  return endpoint;
}

function getAuthorizationHeader() {
  const basicToken = process.env.WORDPRESS_BASIC_AUTH_TOKEN;

  if (basicToken) {
    return basicToken.startsWith("Basic ") ? basicToken : `Basic ${basicToken}`;
  }

  const username =
    process.env.WORDPRESS_USERNAME ??
    process.env.WORDPRESS_USER ??
    process.env.WORDPRESS_LOGIN;
  const password = process.env.WORDPRESS_APPLICATION_PASSWORD;

  if (!username || !password) {
    return undefined;
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function wordpressGraphQL<TData>(
  query: string,
  variables?: Record<string, string | number>,
  revalidateSeconds: number = REVALIDATE_SECONDS.post
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const authorization = getAuthorizationHeader();

  if (authorization) {
    headers.Authorization = authorization;
  }

  const response = await fetch(getWordPressEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    next: { revalidate: revalidateSeconds }
  });

  const payload = (await response.json().catch(() => null)) as GraphQLResponse<TData> | null;

  if (!response.ok || !payload) {
    throw new Error(`WordPress GraphQL request failed with HTTP ${response.status}`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("WordPress GraphQL response did not include data.");
  }

  return payload.data;
}

function stripHtml(value?: string | null) {
  return (value ?? "").replace(/<[^>]*>/g, " ");
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === "#") {
      const isHex = code[1]?.toLowerCase() === "x";
      const number = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }

    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

function cleanText(value?: string | null) {
  return decodeHtmlEntities(stripHtml(value).replace(/\s+/g, " ").trim());
}

function normalizeCategories(nodes?: WordPressCategoryNode[] | null) {
  return (nodes ?? [])
    .map((category) => ({
      name: cleanText(category.name),
      slug: category.slug ?? ""
    }))
    .filter((category) => category.name && category.slug);
}

function normalizePost(node: WordPressPostNode): BlogPost | null {
  const slug = node.slug ?? "";
  const title = cleanText(node.title);

  if (!slug || !title) {
    return null;
  }

  const featuredImage = node.featuredImage?.node?.sourceUrl
    ? {
        sourceUrl: node.featuredImage.node.sourceUrl,
        altText: node.featuredImage.node.altText ?? title
      }
    : null;

  return {
    id: node.databaseId ?? 0,
    title,
    slug,
    uri: node.uri ?? `/blog/${slug}`,
    date: node.date ?? null,
    modified: node.modified ?? null,
    excerpt: cleanText(node.excerpt),
    content: node.content ?? "",
    author: cleanText(node.author?.node?.name) || "대전세븐나이트",
    categories: normalizeCategories(node.categories?.nodes),
    featuredImage
  };
}

export async function getBlogPosts(first = 12): Promise<BlogPostSummary[]> {
  const data = await wordpressGraphQL<PostsQueryData>(
    POSTS_QUERY,
    { first },
    REVALIDATE_SECONDS.posts
  );

  return (data.posts?.nodes ?? [])
    .map(normalizePost)
    .filter((post): post is BlogPost => Boolean(post))
    .map(({ content: _content, ...post }) => post);
}

// generateMetadata()와 page()가 동일 slug를 각각 호출해도
// 같은 요청 사이클 안에서는 WordPress에 한 번만 요청하도록 dedupe
export const getBlogPostBySlug = cache(async (slug: string): Promise<BlogPost | null> => {
  const data = await wordpressGraphQL<PostQueryData>(
    POST_BY_SLUG_QUERY,
    { slug },
    REVALIDATE_SECONDS.post
  );

  return data.post ? normalizePost(data.post) : null;
});

export async function getBlogPostSlugs(first = 50) {
  const posts = await getBlogPosts(first);

  return posts.map((post) => ({
    slug: post.slug,
    modified: post.modified
  }));
}

const POSTS_BY_CATEGORY_QUERY = `
  query BlogPostsByCategory($categoryName: String!, $first: Int!) {
    posts(first: $first, where: { categoryName: $categoryName, orderby: { field: DATE, order: DESC } }) {
      nodes {
        databaseId
        title
        slug
        uri
        date
        modified
        excerpt
        author {
          node {
            name
          }
        }
        categories(first: 8) {
          nodes {
            name
            slug
          }
        }
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
      }
    }
  }
`;

export async function getBlogPostsByCategory(
  categorySlug: string,
  first = 3
): Promise<BlogPostSummary[]> {
  const data = await wordpressGraphQL<PostsQueryData>(
    POSTS_BY_CATEGORY_QUERY,
    { categoryName: categorySlug, first },
    REVALIDATE_SECONDS.postsByCategory
  );

  return (data.posts?.nodes ?? [])
    .map(normalizePost)
    .filter((post): post is BlogPost => Boolean(post))
    .map(({ content: _content, ...post }) => post);
}
