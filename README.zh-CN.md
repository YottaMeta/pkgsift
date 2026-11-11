# PkgSift（包筛）

[![npm version](https://img.shields.io/npm/v/@yottameta/pkgsift.svg)](https://www.npmjs.com/package/@yottameta/pkgsift)
[![CI](https://github.com/YottaMeta/pkgsift/actions/workflows/ci.yml/badge.svg)](https://github.com/YottaMeta/pkgsift/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

[English](README.md) | **简体中文**

**装之前，先筛一遍。**

PkgSift 在 `npm install` / `pip install` 之前检查依赖清单：包是否存在、名字是否像热门包的拼写抢注、是否是新注册的可疑包、是否带安装脚本。只读公共注册表元数据，不下载、不执行被检查的包。

不用 LLM，不上传源码，不做行为分析。确定性规则 + 公开元数据。

## 为什么需要它

AI 生成的代码经常编出不存在的包名，或者把 `axios` 写成 `axois`。攻击者会抢注这些名字，等你一安装就执行恶意脚本。PkgSift 把检查提前到安装之前，5 秒内给出结论。

## 快速开始

### 最简用法：先扫描，再安装

在项目根目录执行：

```bash
npx @yottameta/pkgsift scan .
```

不需要先 `npm install`。PkgSift 只读清单文件，然后查询 npm / PyPI 公共注册表。

如果有 `block` 级问题，先修清单，再安装：

```bash
npx @yottameta/pkgsift scan . && npm install
```

### 安装到项目里

```bash
npm install --save-dev @yottameta/pkgsift
```

在 `package.json` 里加一个脚本：

```json
{
  "scripts": {
    "deps:sift": "pkgsift scan . --fail-on block"
  }
}
```

之后运行：

```bash
npm run deps:sift
```

> 不要把它放进 `preinstall` / `postinstall`：安装过程中 bin 链接可能还没建好，容易失败。用独立脚本或 CI 步骤。

## 扫描的是哪个目录？

- CLI：`scan .` 扫描**当前工作目录**；`scan path/to/project` 扫描指定目录。它不会扫描自己安装在哪里，输出里的 `under ...` 就是实际根目录。
- 目录下的清单会被递归发现（跳过 `node_modules`）。monorepo 如果只想看某个子项目，直接传子目录。
- GitHub Action：`path` 相对于 `actions/checkout` 检出的仓库根目录（`GITHUB_WORKSPACE`），不是 Action 自己的仓库。

```yaml
- uses: YottaMeta/pkgsift@action-v1
  with:
    path: apps/web
```

多个子项目就写多个 step，或传仓库根目录让 PkgSift 递归找清单。

## 输出怎么看

示例（有阻断项时）：

```text
Scanned 1 manifest(s) and 12 dependencies under /path/to/project

BLOCK PKG001 expresss@^4.18.2 — package.json:18
  Package "expresss" does not exist in the npm registry.
  fix: Remove it, or replace it with the package you actually meant.

thresholds: new package < 30d · typosquat ≤ 1 (≤ 2 for names ≥ 8 chars)
block 1 · warn 0 · info 0 · unknown 0
1 blocking issue(s) found.
```

三档结论：

| 结论 | 含义 | 建议 |
| --- | --- | --- |
| `BLOCK` | 高置信问题，例如包不存在、同形字仿冒 | 不要安装，先修清单 |
| `WARN` | 启发式命中，例如拼写接近热门包、新包、安装脚本 | 人工确认来源后再决定 |
| `INFO` | 提示信号 | 了解即可，不阻断 |

退出码：

| 退出码 | 含义 |
| --- | --- |
| 0 | 没有达到 `--fail-on` 的问题 |
| 1 | 存在达到 `--fail-on` 的问题（默认 `block`） |
| 2 | 扫描不完整（网络失败、清单读不了）或参数非法 |

`unknown` 和退出码 2 都表示「这次没扫完」，**不能当成通过**。

## 检测规则

| 规则 | 检查什么 | 默认动作 |
| --- | --- | --- |
| PKG001 | 包在注册表中不存在（幻觉包或已删除） | block |
| PKG002 | 名字与热门包相差 1–2 个编辑，或去掉同形字后与热门包相同；数字版本后缀（如 `http-proxy-3`）视为有意分叉 | warn（同形字 block） |
| PKG003 | 首次发布 < 30 天，且无仓库链接或只有单维护者 | warn |
| PKG004 | 定义 `preinstall` / `install` / `postinstall` 脚本（常见合法包已白名单） | warn |

支持的清单：`package.json`、`requirements.txt`（含 `-r`）、`pyproject.toml`、`Pipfile`。

`file:`、`link:`、`workspace:`、`git+`、直接 URL、npm 别名等不经过公共注册表的依赖会被跳过，避免误报。

## 输出格式

```bash
pkgsift scan .                          # 人类可读
pkgsift scan . --format json            # 机器可读（--json 等价）
pkgsift scan . --format markdown        # 适合 PR 评论
pkgsift scan . --format sarif > out.sarif
```

常用参数：

```bash
pkgsift scan ./app --fail-on warn       # warn 也让 CI 失败
pkgsift scan . --no-cache               # 跳过 24h 本地缓存
```

## 接入 GitHub Actions

在仓库里新建 `.github/workflows/pkgsift.yml`：

```yaml
name: PkgSift

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: YottaMeta/pkgsift@action-v1
        with:
          path: .
          fail-on: block
```

- Action 会把 Markdown 报告写到 Job Summary，并在 PR 里创建或更新一条评论。
- 同一仓库的 PR 可以直接评论；fork PR 的 `GITHUB_TOKEN` 通常是只读的，评论会跳过，但扫描失败仍会阻断。
- 需要 SARIF 上传时，可以单独跑 CLI：

```yaml
- run: npx @yottameta/pkgsift scan . --format sarif --fail-on block > pkgsift.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: pkgsift.sarif
```

## 配置

| 环境变量 | 作用 |
| --- | --- |
| `PKGSIFT_NPM_REGISTRY` | npm 注册表地址（默认 `https://registry.npmjs.org`） |
| `PKGSIFT_PYPI_REGISTRY` | PyPI 地址（默认 `https://pypi.org`） |
| `PKGSIFT_CACHE_DIR` | 元数据缓存目录（默认 `~/.cache/pkgsift`，24h） |

PkgSift 自己直接访问官方注册表，不受你本机 `npm config registry` 影响。如果网络需要走镜像，再用上面的变量覆盖。

国内网络直连 `pypi.org` 可能较慢（JSON 接口可能超过 10 秒），建议指定镜像。

Git Bash / macOS / Linux：

```bash
export PKGSIFT_PYPI_REGISTRY=https://pypi.tuna.tsinghua.edu.cn
# 或 https://mirrors.cloud.tencent.com/pypi
```

Windows CMD（只对当前窗口生效）：

```cmd
set "PKGSIFT_PYPI_REGISTRY=https://pypi.tuna.tsinghua.edu.cn"
```

长期生效用 `setx PKGSIFT_PYPI_REGISTRY "https://pypi.tuna.tsinghua.edu.cn"`，然后重新打开 CMD 窗口。

查询超时的依赖会显示 `UNKNOWN`，退出码为 2，并明确提示「Scan incomplete — this is not a pass」，不会当成通过。

## 常见问题

**会不会上传我的代码？**
不会。只读取清单文件里的包名和版本范围，然后查询公共注册表；源码、环境变量、lockfile 内容都不上传。

**会不会执行被检查的包？**
不会。不下载、不安装、不运行。只看注册表元数据。

**为什么出现 `UNKNOWN`？**
某个依赖查询注册表超时或失败，这次扫描不完整，退出码是 2，不是通过。重试、换镜像（见上方配置）或稍后再跑。

**和 SCA / Dependabot 有什么区别？**
它们查已知漏洞和许可证；PkgSift 查「这个包该不该装」，重点是不存在、拼写抢注、新包和安装脚本。两者互补。

**误报怎么办？**
安全工具最怕误报。PkgSift 只有高置信信号才 `block`，启发式一律 `warn`。遇到误报请开 issue，带上包名和清单片段。

**支持哪些生态？**
当前支持 npm 和 PyPI。Maven / Go 等后续版本再评估。

## 开发

```bash
npm install
npm test
npm run typecheck
npm run build
node dist/cli.js scan .
```

重新生成热门包基准：

```bash
npm run data:popular
node scripts/build-popular.mjs --npm-rank ./raw.json --pypi-top ./top-pypi.json
```

这个命令只重写 `src/data/popular.json`，扫描时不会联网构建基准。

## 许可证

Apache-2.0。第三方组件与数据来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
