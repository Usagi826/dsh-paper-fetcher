# 文献下载 (dsh-paper-fetcher)

在左侧「文献下载」面板输入论文标题 / DOI / arXiv 编号 / PDF 直链，自动检索开放获取 PDF，
按 `{年份} - {期刊缩写} - {标题}.pdf` 命名保存到所选目录（默认桌面）。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-blue.svg)

## 安装

需要先安装 **DeepSeek Harness 桌面版**。

1. 打开 **插件** 页，点右上角 **添加插件**。
2. 填入包名 `dsh-paper-fetcher`（或仓库地址 `Usagi826/dsh-paper-fetcher`），点 **安装**。
3. 重启 DeepSeek Harness，左侧「自动化」下方出现 **文献下载** 图标即安装成功。

升级时在插件页重装即可。插件以本机用户权限运行，请只安装来源可信的版本。

## 使用

1. 左侧栏「文献下载」图标（或「更多」菜单）打开面板。
2. 搜索框输入标题、DOI、`arXiv:1706.03762` 或链接，回车提交（`Shift+Enter` 换行）；框体随内容增高，最多 10 行。
3. 粘贴整段文献列表自动切换批量模式：逐条识别、依次下载，显示进度与成败计数，可随时停止（上限 50 条）。
4. 右上角切换保存位置，默认桌面，选择会被记住。
5. 结果显示文件名、路径、来源与尝试过的链接，失败时给出可手动打开的链接。

## 检索与校验

| 顺序 | 来源 |
| --- | --- |
| 1 | arXiv 已知编号 |
| 2 | 出版商镜像（Nature 系 `10.1038/` 走 `link.springer.com`） |
| 3 | ChinaXiv（仅中文文献，见下） |
| 4 | Unpaywall |
| 5 | Semantic Scholar |
| 6 | bioRxiv / medRxiv / chemRxiv 预印本（文件名标注 `(preprint)`） |
| 7 | doi.org 落地页里的 PDF 链接（仅前面各项全失败时） |

- 排在前的来源命中后不再请求后面的；单个候选 20 s 超时。
- 元数据来自 Crossref → OpenAlex → Semantic Scholar。
- 每个候选校验 `%PDF-` 文件头、大小与页数：少于 3 页视为摘要 / 封面 / 更正并丢弃；PDF 内 DOI 与目标不符也跳过。
- 落地页链接会排除 supplement、MOESM、peer-review、correction 等附件。

### 中文文献

标题或刊名里出现汉字、或 DOI 属于中国注册机构时，额外检索 **ChinaXiv**（中科院预印本平台），可免登录直接下载 PDF。

**收录范围有限**：ChinaXiv 只收预印本，中文期刊正刊基本不在其中。知网、万方、维普，以及《中国科学院院刊》《软件学报》等期刊的全文需要机构订阅或登录，插件不会绕过——这类文献只给出元数据和 `link.cnki.net` 等手动链接。实测中文正刊命中率很低，请勿期待自动下载。

## 期刊缩写

文件名用 NLM/CASSI 标准缩写（`Nat. Neurosci`），面板同时显示全称。缩写来源依次为：

1. Crossref 的 `short-container-title`；
2. 内置离线表 `lib/journals.json`（常用期刊缩写 + 8000+ ISSN）；
3. Crossref 按 DOI / ISSN 查询该刊其他论文；
4. NLM 词表规则拼装（200+ 期刊词，功能词按规范省略）。

出版社平台名（如 `Elsevier BV`）不作为刊名。

## 下载记录

- 每次检索都写入本地记录，保留 50 条 / 90 天；成功与失败均按规范文件名显示，失败标注「未保存」并给出计划路径。
- 失败条目可用「重新下载」重试，或「手动搜索」用系统默认浏览器在 `cn.bing.com` 搜索标题。
- 点击记录只切换详情，不影响正在进行的下载。
- 侧栏图标上的小圆点：下载中呼吸闪烁，有未读记录时常亮。

## 说明

- 任务在后台运行：切换或关闭面板都不会中断下载。
- 联系邮箱与保存目录只存在本机浏览器，不随插件分发。
- 仅下载开放获取全文，不绕过付费墙；请遵守出版商条款与机构订阅协议。
- 中文文献仅覆盖 ChinaXiv 预印本，期刊正刊需在知网等平台自行获取。
- 无第三方运行时依赖，安装无需编译。

## 接口

`POST /paper-download/<endpoint>`，JSON 请求，返回 `{ ok, value }` / `{ ok, error }`：

| 端点 | 参数 | 作用 |
| --- | --- | --- |
| `resolve` | `{ query, directory?, email? }` | 检索并下载 |
| `folders` | `{ path? }` | 目录浏览 |
| `reveal` | `{ path }` | 在资源管理器中定位文件 |
| `openExternal` | `{ url }` | 用默认浏览器打开链接 |

## 开发与发布

- 修改后递增 `package.json` 的 `version`，并在 [CHANGELOG.md](CHANGELOG.md) 记录一条。
- 发布：在插件目录执行 `node publish.cjs`，通过 GitHub API 上传，提交说明默认留空。

## 许可

[MIT](LICENSE) © 2026 朱骏 (Zhu Jun)
