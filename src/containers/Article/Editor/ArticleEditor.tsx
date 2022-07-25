import style from "./ArticleEditor.module.scss"
import articleStyle from "../../../components/NFTArticle/NFTArticle.module.scss"
import cs from "classnames"
import TextareaAutosize from "react-textarea-autosize"
import { useCallback, useContext, useMemo, useRef, useState } from "react"
import { SlateEditor } from "../../../components/NFTArticle/SlateEditor"
import { Dropzone } from "../../../components/Input/Dropzone"
import { Spacing } from "../../../components/Layout/Spacing"
import { Field } from "../../../components/Form/Field"
import { FormikHelpers, useFormik } from "formik"
import { InputSplits } from "../../../components/Input/InputSplits"
import { transformSplitsSum1000 } from "../../../utils/transformers/splits"
import { Donations } from "../../Input/Donations"
import { Submit } from "../../../components/Form/Submit"
import { Button } from "../../../components/Button"
import { InputTextUnit } from "../../../components/Input/InputTextUnit"
import {
  getMarkdownFromSlateEditorState,
  getSlateEditorStateFromMarkdown
} from "../../../components/NFTArticle/processor"
import { IEditorMediaFile } from "../../../types/ArticleEditor/Image"
import { FxEditor, NFTArticleForm } from "../../../types/ArticleEditor/Editor"
import { EditorMedias } from "./EditorMedias"
import { ImagePolymorphic } from "../../../components/Medias/ImagePolymorphic"
import { arrayRemoveDuplicates } from "../../../utils/array"
import { AutosaveArticle } from "./AutosaveArticle";
import { debounce } from "../../../utils/debounce";
import { Descendant } from "slate";
import { LoaderBlock } from "../../../components/Layout/LoaderBlock";
import useInit from "../../../hooks/useInit";
import { isUrlLocal } from "../../../utils/files";
import useConfirmLeavingPage from "../../../hooks/useConfirmLeavingPage";
import * as Yup from "yup";
import { countWords } from "../../../utils/strings";
import { UserContext } from "../../UserProvider"
import { ErrorBlock } from "../../../components/Error/ErrorBlock"

const editorDefaultValue = [
  {
    type: "paragraph",
    children: [{
      text: ""
    }]
  }
]

const defaultValues: NFTArticleForm = {
  title: "",
  body: "",
  thumbnailUri: null,
  thumbnailCaption: "",
  abstract: "",
  editions: "",
  royalties: "",
  royaltiesSplit: [],
  tags: []
}

const schemaNftArticleForm = Yup.object().shape({
  title: Yup.string().required('Required'),
  abstract: Yup.string()
    .required('Required')
    .test('nbWords', 'Max 500 words', val => countWords(val || '') <= 500),
  body: Yup.string().required('Required'),
  thumbnailUri: Yup.mixed()
    .required("Required")
    .test("thumbnail", "Invalid type", (value) => {
      return typeof value === "string"
    }),
  thumbnailCaption: Yup.string(),
  editions: Yup.number()
    .required('Min 1 edition')
    .min(1, "Min 1 edition"),
  royalties: Yup.number()
    .required('Required')
    .min(1, "Min 1%")
    .max(25, "Max 25%"),
  royaltiesSplit: Yup.array()
    .of(Yup.object().shape({
      address: Yup.string(),
      pct: Yup.number()
    }))
    .required("Req At least 1 address")
    .min(1, "At least 1 address"),
  tags: Yup.array().of(Yup.string())
})

interface ArticleEditorProps {
  localId?: string,
  hasLocalAutosave?: boolean
  initialValues?: NFTArticleForm,
  onSubmit: (values: NFTArticleForm, formikHelpers: FormikHelpers<NFTArticleForm>) => (void | Promise<any>)
}
export function ArticleEditor({
  localId,
  hasLocalAutosave,
  initialValues,
  onSubmit,
}: ArticleEditorProps) {
  const { user } = useContext(UserContext)
  const [immutableInitialValues] = useState(initialValues)
  const editorStateRef = useRef<FxEditor>(null)
  const formik = useFormik({
    initialValues: immutableInitialValues || {
      ...defaultValues,
      // we add the user as default target to royalties split
      royaltiesSplit: user ? [{
        address: user.id,
        pct: 1000,
      }]:[]
    },
    onSubmit,
    validationSchema: schemaNftArticleForm,
    validateOnMount: true,
  });
  const { values, errors, touched, setFieldValue, setFieldTouched } = formik
  console.log(values)
  const [thumbnail, setThumbnail] = useState<string|null>(values.thumbnailUri)
  const [medias, setMedias] = useState<IEditorMediaFile[]>([])
  const [initialBody, setInitialBody] = useState<Descendant[] | null>(null)

  const handleChangeBody = useCallback(async (nodes: Descendant[]) => {
    const markdown = await getMarkdownFromSlateEditorState(nodes);
    setFieldTouched('body');
    await setFieldValue('body', markdown);
  }, [setFieldTouched, setFieldValue])
  const debouncedChangeBody = useMemo(() => debounce(handleChangeBody, 800), [handleChangeBody])
  const handleInitEditor = useCallback((editor) => {
    setMedias(editor.getUploadedMedias() || []);
  }, [])

  // update the thumbnail by creating a local URL from a given file
  const updateThumbnail = useCallback((file: File|null) => {
    setThumbnail(
      file ? URL.createObjectURL(file) : null
    )
  }, [])

  // add the thumbnail to the list of medias
  const mediasWithThumbnail = useMemo(
    () => thumbnail ?
      arrayRemoveDuplicates([
        {
          uri: thumbnail,
          type: "image"
        } as IEditorMediaFile,
        ...medias
      ],
      (a, b) => a.uri === b.uri
      ) : medias,
    [thumbnail, medias]
  )

  // when a media uri is updated (via IPFS upload)
  const onMediaUriUpdate = useCallback((target: IEditorMediaFile, uri: string) => {
    // should the thumbnail be updated ?
    if (thumbnail === target.uri) {
      setThumbnail(uri)
      setFieldValue("thumbnailUri", uri);
    }
    // update the medias in the editor
    editorStateRef.current?.updateMediaUrl(
      target,
      uri
    )
  }, [setFieldValue, thumbnail])

  useInit(async () => {
    const editorFromMd = values.body ? await getSlateEditorStateFromMarkdown(values.body) : null;
    setInitialBody(editorFromMd ? editorFromMd.editorState : editorDefaultValue);
  })

  const hasLocalMedias = useMemo(() => mediasWithThumbnail.some(media => isUrlLocal(media.uri)), [mediasWithThumbnail]);
  useConfirmLeavingPage(hasLocalMedias, 'You have unsaved medias, please ensure you upload everything before leaving the page. Are you sure you want to leave?');

  // create a list of errors
  const errorsList = useMemo<string[]>(() => {
    const requiredActions: string[] = [];

    if (hasLocalMedias) {
      requiredActions.push("there are medias not uploaded to IPFS")
    }
    const errorsEntries = Object.entries(errors);
    if (errorsEntries.length > 0) {
      errorsEntries.forEach(([key, value]) => {
        requiredActions.push(`${key}: ${value}`)
      })
    }
    
    return requiredActions
  }, [errors, hasLocalMedias])

  // article can be minted if no errors
  const hasErrors = errorsList.length > 0

  return (
    <form onSubmit={formik.handleSubmit}>
      {hasLocalAutosave && localId &&
        <AutosaveArticle
          id={localId}
          formValues={values}
          hasUnsavedMedias={hasLocalMedias}
        />
      }
      <Field
        className={style.field}
        classNameError={style.field_error}
        error={touched.title ? errors.title : undefined}
      >
        <div className={cs(style.section_title)}>
          <span>
            TITLE
          </span>
        </div>
        <TextareaAutosize
          value={values.title}
          name="title"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          className={cs(style.input_title)}
          minRows={1}
          placeholder="Title of the article"
        />
      </Field>

      <Field className={style.field} classNameError={style.field_error} error={touched.abstract && errors.abstract}>
        <div className={cs(style.section_title)}>
          <span>
            ABSTRACT
          </span>
        </div>
        <TextareaAutosize
          name="abstract"
          value={values.abstract}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          className={cs(style.input_abstract, style.w900)}
          minRows={1}
          placeholder="A short description (max 500 words) about the content of the article. The abstract is by default displayed at the top of the article on fxhash and is being used to introduce articles when space is limited."
        />
      </Field>

      <Field className={style.field} classNameError={style.field_error} error={errors.thumbnailUri}>
        <div className={cs(style.section_title)}>
          <span>
            THUMBNAIL
          </span>
        </div>
        <Dropzone
          className={cs(style.thumbnail_dropzone, {
            [style.image_loaded]: !!thumbnail
          })}
          onChange={(files) => updateThumbnail(files?.[0] || null)}
          textDefault={
            thumbnail ? (
              <ImagePolymorphic
                uri={thumbnail}
              />
            ):(
              <div className={cs(style.placeholder_wrapper)}>
                <i className="fa-solid fa-image" aria-hidden/>
                <span>
                  Select a thumbnail
                </span>
              </div>
            )
          }
          textDrag={
            thumbnail ? (
              <ImagePolymorphic
                uri={thumbnail}
              />
            ):(
              <div className={cs(style.placeholder_wrapper)}>
                <i className="fa-solid fa-image" aria-hidden/>
                <span>
                  Drop your image
                </span>
              </div>
            )
          }
          accepted={["image/jpeg", "image/png", "image/gif"]}
        />
        <TextareaAutosize
          value={values.thumbnailCaption}
          className={cs(style.input_caption)}
          minRows={1}
          name="thumbnailCaption"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          placeholder="Thumbnail caption..."
        />
      </Field>

      <Field className={style.field} classNameError={style.field_error} error={touched.body && errors.body}>
        <div className={cs(style.section_title)}>
          <span>
            BODY
          </span>
        </div>
        <div className={cs(articleStyle.article_wrapper)}>
          {initialBody ?
            <SlateEditor
              ref={editorStateRef}
              initialValue={initialBody}
              placeholder="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis ut magna eu sapien placerat auctor. Phasellus vel erat a mi cursus posuere nec et diam. Maecenas quis nisl ligula. Sed velit sapien, accumsan eget cursus sit amet, egestas sit amet odio. Cras vitae urna sodales, suscipit ipsum a, aliquam ex. Pellentesque ut placerat arcu, a fringilla ante. Sed varius sem mi, sed interdum nunc consectetur ut. Nulla consectetur diam purus, quis volutpat nunc ultrices eget. Nam vel consectetur lacus, vel auctor dolor."
              onMediasUpdate={setMedias}
              onChange={debouncedChangeBody}
              onInit={handleInitEditor}
            />
            : <LoaderBlock size="small" height="20px" />
          }
        </div>
      </Field>

      <Spacing size="6x-large"/>

      <div className={cs(style.sep)}/>

      <Spacing size="6x-large"/>

      <div className={cs(style.w900)}>
        <Field>
          <label>
            Medias ({mediasWithThumbnail.length})
            <small>Before the article can be published, all the medias within the article must be uploaded to IPFS</small>
          </label>
          <EditorMedias
            medias={mediasWithThumbnail}
            onMediaUriUpdate={onMediaUriUpdate}
          />
        </Field>

        <Field error={errors.editions}>
          <label htmlFor="editions">
            Number of editions
            <small>How many collectible editions <strong>(soon collectible on fxhash)</strong></small>
          </label>
          <InputTextUnit
            unit=""
            type="number"
            name="editions"
            value={values.editions}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={!!errors.editions}
          />
        </Field>

        <Field error={errors.royalties}>
          <label htmlFor="royalties">
            Royalties
            <small>Between 0% and 25%</small>
          </label>
          <InputTextUnit
            unit="%"
            type="number"
            name="royalties"
            min={0.1}
            step={0.1}
            max={25}
            value={values.royalties}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={!!errors.royalties}
          />
        </Field>

        <Field
          error={typeof errors.royaltiesSplit === "string"
            ? errors.royaltiesSplit
            : undefined
          }
        >
          <label>
            Royalties Splits
            <small>
              You can also split the proceeds on the secondary (royalties will be divided between the addresses)
            </small>
          </label>
          <InputSplits
            value={values.royaltiesSplit}
            onChange={splits => setFieldValue("royaltiesSplit", splits)}
            sharesTransformer={transformSplitsSum1000}
            textShares="Shares (out of 1000)"
            errors={errors.royaltiesSplit as any}
          >
            {(({ addAddress }) => (
              <div className={cs(style.royalties_last_row)}>
                <Donations
                  onClickDonation={addAddress}
                />
              </div>
            ))}
          </InputSplits>
        </Field>

        <Spacing size="3x-large"/>

        {hasErrors &&
          <ErrorBlock
            title="You need to resolve the following errors before you can mint:"
            align="left"
          >
            <ul>
              {errorsList.map((err, idx) => (
                <li key={idx}>
                  {err}
                </li>
              ))}
            </ul>
          </ErrorBlock>
        }
        <Submit layout="center">
          <Button
            type="submit"
            size="large"
            color="secondary"
            disabled={hasErrors}
          >
            preview &amp; mint
          </Button>
        </Submit>
      </div>
    </form>
  )
}
