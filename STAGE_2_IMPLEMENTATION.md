# Stage 2 Implementation Plan
## Communities & Content Management

> **Status:** 🚧 **IN PROGRESS** - Implementing community engine  
> **Goal:** Launch scalable community engine with creation, discovery, membership, rich posts, comments, jobs, and comprehensive testing

---

## 📋 Implementation Roadmap

### Phase 1: Database & Schema Extensions
- [ ] **2.1** Database schema for communities, posts, comments, votes, jobs
- [ ] **2.1** RLS policies for community-based content access
- [ ] **2.1** Database triggers for vote scoring and aggregations

### Phase 2: Test Framework Setup
- [ ] **2.14** Jest testing framework setup
- [ ] **2.14** Test database setup and teardown
- [ ] **2.14** Mock services for isolated testing

### Phase 3: Community Management
- [ ] **2.2** Community creation wizard (`/create_community`)
- [ ] **2.3** Community discovery (`/communities`)
- [ ] **2.4** Join flow for public/private communities (`/join`)

### Phase 4: Content System
- [ ] **2.5** Feed API with cursor-based pagination
- [ ] **2.6** Post creation (text, image, link, poll)
- [ ] **2.7** Voting system (up/down votes)
- [ ] **2.8** Comment threading (≤3 levels deep)

### Phase 5: Job Board & Search
- [ ] **2.9** Job board with filters (`/jobs`)
- [ ] **2.10** Full-text search (`/search`)

### Phase 6: Moderation & Security
- [ ] **2.11** Moderation tools (`/delete`, `/pin`, `/ban`)
- [ ] **2.12** Enhanced rate limiting (5 posts/10min)
- [ ] **2.13** Media security (5MB limit, type validation)

### Phase 7: Performance & Testing
- [ ] **2.14** Performance tests (p95 < 300ms)
- [ ] **2.14** Coverage ≥80% requirement
- [ ] **2.14** End-to-end validation tests

---

## 🗂️ Database Schema Plan

### New Tables Required:
```sql
-- Communities
CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  creator_id UUID REFERENCES users(id),
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community Members
CREATE TABLE community_members (
  community_id UUID REFERENCES communities(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member', -- admin, moderator, member
  status VARCHAR(20) DEFAULT 'active', -- active, pending, banned
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

-- Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id),
  author_id UUID REFERENCES users(id),
  title VARCHAR(200),
  content JSONB, -- {type: 'text'|'image'|'link'|'poll', data: {...}}
  vote_score INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id),
  parent_id UUID REFERENCES comments(id), -- for threading
  author_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  vote_score INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes
CREATE TABLE votes (
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id),
  comment_id UUID REFERENCES comments(id),
  vote_type INTEGER CHECK (vote_type IN (-1, 1)), -- -1 down, 1 up
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK ((post_id IS NULL) != (comment_id IS NULL)), -- XOR constraint
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id)
);

-- Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id),
  poster_id UUID REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  is_remote BOOLEAN DEFAULT false,
  location VARCHAR(100),
  application_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Applications
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id),
  applicant_id UUID REFERENCES users(id),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, applicant_id)
);

-- Audit Events (extend existing)
-- Add to existing audit_events: 'post_create', 'comment_create', 'vote', 'join_community', 'moderate'
```

---

## 🤖 Bot Commands Plan

### New Commands to Implement:
- `/create_community` - 5-step community creation wizard
- `/communities` - Browse and discover communities  
- `/join {slug}` - Join a community by slug
- `/leave {slug}` - Leave a community
- `/feed` - View personalized content feed
- `/post` - Create new post in current community
- `/jobs` - Browse job listings with filters
- `/search {query}` - Search posts, communities, jobs
- `/moderate` - Moderation tools for admins

### Enhanced Commands:
- `/admin_panel` - Add community management tools
- `/test` - Add community system status checks

---

## 🔧 Services to Implement

### Core Services:
- `CommunityService` - CRUD operations for communities
- `PostService` - Post creation, editing, voting
- `CommentService` - Threading, voting, moderation
- `JobService` - Job posting and applications
- `SearchService` - Full-text search with ranking
- `ModerationService` - Content moderation tools
- `FeedService` - Personalized content feeds
- `MediaService` - File upload and validation

### Enhanced Services:
- `RateLimiterService` - Content-specific rate limits
- `NotificationService` - User notifications
- `CacheService` - Redis caching for performance

---

## 🧪 Testing Strategy

### Test Categories:
1. **Unit Tests** - Individual service methods
2. **Integration Tests** - Database interactions
3. **Bot Command Tests** - End-to-end command flows
4. **Performance Tests** - Feed response times
5. **Security Tests** - RLS policy enforcement

### Key Test Scenarios:
- Happy path community creation → success
- Duplicate slug → rejection
- Private community join → pending status
- Feed pagination → cursor maintenance
- Vote flipping → score updates
- Comment depth limit → blocking
- Rate limit breach → throttling
- RLS enforcement → access control

---

## 📊 Success Metrics

### Performance Requirements:
- Feed API p95 latency < 300ms
- Community discovery < 300ms first page
- Search results < 500ms
- Test coverage ≥ 80%

### Functional Requirements:
- ✅ All 14 deliverables implemented
- ✅ All validation tests passing
- ✅ Security guardrails active
- ✅ Rate limits enforced
- ✅ RLS policies protecting data

---

## 🚀 Next Steps

### Immediate Actions:
1. **Database Schema** - Implement all new tables and triggers
2. **Test Framework** - Set up Jest with test database
3. **Community Commands** - Implement creation wizard
4. **Basic Feed** - Get post display working
5. **Vote System** - Implement up/down voting

### Critical Path:
Database → Tests → Communities → Posts → Search → Moderation → Performance

---

## 📁 File Structure to Add

```
packages/bot/src/
├── services/
│   ├── communityService.ts     # Community CRUD
│   ├── postService.ts          # Post management
│   ├── commentService.ts       # Comment threading
│   ├── jobService.ts           # Job board
│   ├── searchService.ts        # Full-text search
│   ├── moderationService.ts    # Moderation tools
│   ├── feedService.ts          # Content feeds
│   └── mediaService.ts         # File handling
├── commands/
│   ├── createCommunity.ts      # Community creation wizard
│   ├── communities.ts          # Community discovery
│   ├── join.ts                 # Join/leave communities
│   ├── feed.ts                 # Content feed
│   ├── post.ts                 # Post creation
│   ├── jobs.ts                 # Job board
│   ├── search.ts               # Search functionality
│   └── moderate.ts             # Moderation commands
├── middleware/
│   ├── communityAuth.ts        # Community-level permissions
│   └── mediaValidation.ts      # File upload validation
└── tests/
    ├── setup.ts                # Test configuration
    ├── services/               # Service tests
    ├── commands/               # Command tests
    └── integration/            # E2E tests
```

---

**READY TO BEGIN IMPLEMENTATION** 🚀