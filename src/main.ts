import * as core from '@actions/core'
import * as github from '@actions/github'

const eslintReportJobName = 'ESLint Report Analysis'

const rulesDictionary: Record<string, string> = {
  'react/self-closing-comp':
    'Этот дополнительный закрывающий тег не нужен. Можно без него.',
  'react/jsx-no-useless-fragment': 'Фрагмент тут не нужен. Можно удалить.'
}

const defaultCommentSuggestion = 'Поправь согласно правилу.'

async function run(): Promise<void> {
  const token = process.env.TOKEN as string
  const octokit = github.getOctokit(token)

  const {
    repo: { owner, repo }
  } = github.context
  const lastCommit = github.context.payload.pull_request?.head.sha as string
  const pullRequestNumber = github.context.payload.pull_request
    ?.number as number

  const pathParams = {
    owner,
    repo,
    pull_number: pullRequestNumber,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }

  const { data: checkRuns } = await octokit.request(
    'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
    {
      ...pathParams,
      ref: lastCommit
    }
  )

  const { id: checkRunId } = checkRuns.check_runs.find(
    ({ name }) => name === eslintReportJobName
  ) as { id: number }

  const { data: annotations } = await octokit.request(
    'GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations',
    {
      ...pathParams,
      check_run_id: checkRunId
    }
  )

  if (annotations.length === 0) {
    return
  }

  const { data: pullRequestMessages } = await octokit.request(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
    {
      ...pathParams
    }
  )

  const setOfMessages = pullRequestMessages.reduce(
    (acc, { path, line, body }) => acc.add(`${path}_${line}_${body}`),
    new Set()
  )

  for (const annotation of annotations) {
    const { path, start_line: startLine, end_line: endLine } = annotation
    const message = annotation.message as string

    const eslintRule = message.slice(1, message.indexOf(']'))
    const commentMessage =
      rulesDictionary[eslintRule] || defaultCommentSuggestion

    const line = startLine === endLine ? startLine : endLine
    const messageForCheck = `${path}_${line}_${commentMessage}`
    const isNewComment = !setOfMessages.has(messageForCheck)

    const commitId = annotation.blob_href.split('/')[6]

    if (isNewComment) {
      await octokit.request(
        'POST /repos/{owner}/{repo}/pulls/{pull_number}/comments',
        {
          ...pathParams,
          body: commentMessage,
          line,
          path,
          commit_id: commitId
        }
      )
    }
  }

  core.setFailed('Check ESLint errors.')
}

try {
  run()
} catch (error) {
  if (error instanceof Error) {
    core.setFailed(error.message)
  }
}
