import type { ComarkElement } from 'comark'
import { defineComarkPlugin } from '../utils/helpers.ts'
import { visitAsync, textContent } from '../utils/index.ts'
import { renderMarkdown } from 'comark/render'
import { validateProps } from '../internal/props-validation.ts'
import type { PropsValidationOptions } from '../internal/props-validation.ts'

export type FallbackBehavior =
  | false
  | 'textContent'
  | 'raw'
  | ((element: ComarkElement) => any | Promise<any>)

interface SecurityOptions extends PropsValidationOptions {
  /**
   * Tags to remove entirely from the output tree.
   * @default []
   */
  blockedTags?: string[]

  /**
   * Tags to allow only in the output tree.
   * @default []
   */
  allowedTags?: string[]

  /**
   * Behavior when encountering an unallowed tag.
   * - false: completely removes the node from the tree
   * - 'textContent': keeps only the text content of the node (strips the tag)
   * - 'raw': returns the original markdown syntax
   * - function: executes a custom callback
   * @default false
   */
  unallowedFallback?: FallbackBehavior
}

export default defineComarkPlugin((options: SecurityOptions = {}) => {
  const {
    blockedTags = [],
    allowedTags = [],
    unallowedFallback = false,
    allowedLinkPrefixes,
    allowedImagePrefixes,
    allowedProtocols,
    defaultOrigin,
    allowDataImages,
  } = options

  const dropSet = new Set(blockedTags.map((t) => t.toLowerCase()))
  const allowSet = new Set(allowedTags.map((t) => t.toLowerCase()))

  const propsOptions: PropsValidationOptions = {
    allowedLinkPrefixes,
    allowedImagePrefixes,
    allowedProtocols,
    defaultOrigin,
    allowDataImages,
  }

  return {
    name: 'security',
    async post(state) {
      await visitAsync(
        state.tree,
        (node) => typeof node !== 'string' && node[0] !== null,
        async (node) => {
          const element = node as ComarkElement
          const tagName = element[0].toLowerCase()

          const isBlocked = dropSet.has(tagName)
          const isNotAllowed = allowSet.size > 0 && !allowSet.has(tagName)

          // return false to remove the node from the tree
          if (isBlocked) {
            return false
          }

          if (isNotAllowed) {
            if (unallowedFallback === 'raw') {
              return await renderMarkdown({ nodes: [element] })
            }

            if (typeof unallowedFallback === 'function') {
              return await unallowedFallback(element)
            }

            if (unallowedFallback === 'textContent') {
              return textContent(element)
            }

            return false
            
          }

          const keys = Object.keys(element[1])

          /**
           * If the element has any props, validate them
           */
          if (keys.length) {
            element[1] = validateProps(element[0], element[1], propsOptions)
          }
        }
      )
    },
  }
})
