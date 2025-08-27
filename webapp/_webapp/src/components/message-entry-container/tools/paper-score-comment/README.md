# Paper Score Comment Component

这个目录包含了Paper Score Comment功能的组件拆分。

## 文件结构

- `index.tsx` - 主组件，负责整体逻辑和状态管理
- `types.ts` - 类型定义
- `utils.ts` - 工具函数（重要性颜色、图标等）
- `comment-item.tsx` - 单个评论项组件
- `stats-summary.tsx` - 统计摘要组件（显示Critical/High/Medium数量）
- `filter-controls.tsx` - 过滤器控制组件（搜索、重要性过滤）
- `comments-list.tsx` - 评论列表组件（过滤和排序逻辑）
- `add-comments-button.tsx` - 添加评论到Overleaf的按钮组件

## 组件职责

### index.tsx

- 解析消息数据
- 管理全局状态（cookies、展开状态等）
- 协调各个子组件

### comment-item.tsx

- 渲染单个评论项
- 处理文本展开/折叠
- 显示重要性标签和图标

### stats-summary.tsx

- 显示评论统计信息
- 按重要性分类显示数量

### filter-controls.tsx

- 提供搜索功能
- 提供重要性过滤
- 显示过滤结果统计

### comments-list.tsx

- 过滤和排序评论
- 处理空状态显示
- 渲染评论列表

### add-comments-button.tsx

- 处理添加评论到Overleaf的逻辑
- 管理加载状态和错误处理
- 显示操作结果

### utils.ts

- `getImportanceColor()` - 根据重要性返回颜色类名
- `getImportanceIcon()` - 根据重要性返回图标名称
- `cleanCommentText()` - 清理评论文本中的表情符号

### types.ts

- `PaperScoreCommentCardProps` - 主组件的props类型定义
