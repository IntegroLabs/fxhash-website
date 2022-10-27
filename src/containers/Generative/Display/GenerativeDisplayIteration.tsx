import React, { memo, useCallback, useMemo, useState } from "react"
import cs from "classnames"
import style from "./GenerativeDisplayIteration.module.scss"
import layout from "../../../styles/Layout.module.scss"
import { Spacing } from "../../../components/Layout/Spacing"
import { EntityBadge } from "../../../components/User/EntityBadge"
import { UserBadge } from "../../../components/User/UserBadge"
import { ListingAccept } from "../../Objkt/ListingAccept"
import { ClientOnlyEmpty } from "../../../components/Utils/ClientOnly"
import { UserGuard } from "../../../components/Guards/UserGuard"
import { MarketplaceActions } from "../../Objkt/MarketplaceActions"
import Link from "next/link"
import {
  getGenerativeTokenMarketplaceUrl,
  getGenerativeTokenUrl,
} from "../../../utils/generative-token"
import { Button } from "../../../components/Button"
import text from "../../../styles/Text.module.css"
import { format } from "date-fns"
import { Labels } from "../../../components/GenerativeToken/Label/Labels"
import nl2br from "react-nl2br"
import { displayPercentage, displayRoyalties } from "../../../utils/units"
import { ListSplits } from "../../../components/List/ListSplits"
import { ipfsGatewayUrl } from "../../../services/Ipfs"
import { gentkLiveUrl } from "../../../utils/objkt"
import { Features } from "../../../components/Features/Features"
import { User } from "../../../types/entities/User"
import { Objkt } from "../../../types/entities/Objkt"
import { GenerativeArtwork } from "../../../components/GenerativeToken/GenerativeArtwork"
import { Clamp } from "../../../components/Clamp/Clamp"

interface GenerativeDisplayIterationProps {
  objkt: Objkt
}

const _GenerativeDisplayIteration = ({
  objkt,
}: GenerativeDisplayIterationProps) => {
  const [showDescription, setShowDescription] = useState(false)
  const handleShowDescription = useCallback(() => setShowDescription(true), [])
  const owner: User = (
    objkt.activeListing ? objkt.activeListing.issuer : objkt.owner
  )!
  const creator: User = objkt.issuer.author
  const tokenFromObjtk = useMemo(() => {
    return {
      name: objkt.name || "",
      metadata: objkt.issuer?.metadata || {},
      labels: objkt.issuer?.labels,
      captureMedia: objkt.captureMedia,
      displayUri: objkt.metadata?.displayUri,
      balance: 0,
    }
  }, [objkt])
  const gentkUrl = useMemo(() => gentkLiveUrl(objkt), [objkt])
  return (
    <>
      <div className={cs(style.artwork_header_mobile, layout.break_words)}>
        <h3>{objkt.name}</h3>
        <Spacing size="regular" />
        <EntityBadge
          classNameAvatar={style.avatar}
          prependText="created by"
          user={creator}
          toggeable
          centered
          size="regular"
        />
        <Spacing size="2x-small" sm="regular" />
        <UserBadge
          classNameAvatar={style.avatar}
          prependText="owned by"
          user={owner}
          size="regular"
        />
        <Spacing size="x-large" />
      </div>

      <div className={cs(layout.cols2, layout["responsive-reverse"])}>
        <div className={cs(style["presentation-details"])}>
          <div className={cs(style.artwork_header)}>
            <EntityBadge
              prependText="created by"
              user={creator}
              size="big"
              toggeable
            />
            <Spacing size="2x-small" />
            <UserBadge prependText="owned by" user={owner} size="big" />
            <Spacing size="x-large" />
            <h3>{objkt.name}</h3>
          </div>

          <Spacing size="x-large" sm="none" />

          <div className={cs(style.buttons)}>
            {objkt.activeListing && (
              <ListingAccept listing={objkt.activeListing} objkt={objkt} />
            )}
            {/* @ts-ignore */}
            <ClientOnlyEmpty style={{ width: "100%" }}>
              <UserGuard forceRedirect={false}>
                <MarketplaceActions objkt={objkt} />
              </UserGuard>
            </ClientOnlyEmpty>
          </div>

          <Spacing size="regular" />

          <div className={cs(layout.buttons_inline, layout.flex_wrap)}>
            <Link href={getGenerativeTokenUrl(objkt.issuer)} passHref>
              <Button isLink={true} size="regular">
                open project
              </Button>
            </Link>
            <Link
              href={getGenerativeTokenMarketplaceUrl(objkt.issuer)}
              passHref
            >
              <Button isLink={true} size="regular">
                open marketplace
              </Button>
            </Link>
          </div>

          <Spacing size="4x-large" sm="x-large" />

          <div className={cs(style.buttons, style.project_infos)}>
            <h4>
              Project #{objkt.issuer.id} — iteration #{objkt.iteration}
            </h4>
            <span className={cs(style.minted)}>
              Minted on{" "}
              {format(new Date(objkt.createdAt), "MMMM d, yyyy' at 'HH:mm")}
            </span>
            {objkt.issuer.labels && (
              <Labels className={style.labels} labels={objkt.issuer.labels} />
            )}
          </div>

          <Spacing size="large" sm="regular" />

          <Clamp
            className={cs(style.description, {
              [style.description_opened]: showDescription,
            })}
            onClickCTA={handleShowDescription}
            labelCTA="read more"
          >
            {nl2br(objkt.metadata?.description)}
          </Clamp>

          <Spacing size="2x-large" sm="regular" />

          <div
            className={cs(
              style.buttons,
              layout.break_words,
              style.extra_details
            )}
          >
            <strong>Royalties</strong>
            <span className={style.mobile_align_right}>
              {displayRoyalties(objkt.royalties)}
            </span>
            <ListSplits name="Royalties split" splits={objkt.royaltiesSplit} />
            {objkt.features && objkt.features.length > 0 && objkt.rarity && (
              <>
                <strong>Rarity</strong>
                <span className={style.mobile_align_right}>
                  {displayPercentage(objkt.rarity)}% (lower is rarer)
                </span>
              </>
            )}
            <strong>Operation hash</strong>
            <a
              target="_blank"
              rel="noreferrer"
              referrerPolicy="no-referrer"
              href={`https://tzkt.io/${objkt.generationHash}`}
              className={cs(text.very_small, style.mobile_align_right)}
            >
              {objkt.generationHash}{" "}
              <i className="fas fa-external-link-square" aria-hidden />
            </a>
            <strong>Metadata</strong>
            {objkt.assigned ? (
              <a
                target="_blank"
                referrerPolicy="no-referrer"
                href={ipfsGatewayUrl(objkt.metadataUri)}
                rel="noreferrer"
                className={style.mobile_align_right}
              >
                view on IPFS{" "}
                <i className="fas fa-external-link-square" aria-hidden />
              </a>
            ) : (
              <em className={cs(text.info)}>not yet assigned</em>
            )}
          </div>
        </div>

        <div className={cs(style["presentation-artwork"])}>
          <GenerativeArtwork
            hideVariations
            token={tokenFromObjtk}
            openUrl={gentkUrl}
            artifactUrl={gentkUrl}
          />

          {objkt.features && objkt.features.length > 0 && (
            <div className={cs(style.features_wrapper, layout.hide_md)}>
              <Spacing size="3x-large" />
              <h4>Features</h4>
              <Spacing size="small" />
              <Features features={objkt.features} />
            </div>
          )}
        </div>
      </div>

      {objkt.features && objkt.features.length > 0 && (
        <div className={cs(style.features_wrapper, layout.show_md)}>
          <Spacing size="3x-large" sm="x-large" />
          <h4>Features</h4>
          <Spacing size="small" sm="large" />
          <Features features={objkt.features} />
        </div>
      )}
    </>
  )
}

export const GenerativeDisplayIteration = memo(_GenerativeDisplayIteration)
