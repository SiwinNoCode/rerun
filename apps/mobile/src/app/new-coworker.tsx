import type { Box } from '@rerun/contracts'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { createCoworker, fetchBoxes } from '@/api/board'
import { boxForNewCoworker, manageableBoxes, newCoworkerBlocker } from '@/auth/access'
import { useAuth, useIsWorkspaceAdmin } from '@/auth/AuthProvider'
import { UNNAMED_BOX_LABEL } from '@/components/home/board'
import { AppText } from '@/components/ui/AppText'
import { GlassButton, GLASS_BUTTON_SIZE } from '@/components/ui/GlassButton'
import { PillButton } from '@/components/ui/PillButton'
import { TextField } from '@/components/ui/TextField'
import { useTheme } from '@/theme/theme'
import { brand, radius, spacing } from '@/theme/tokens'

const NAME_MAX = 60

function BoxRow({ box, selected, onPress, divided }: { box: Box; selected: boolean; onPress: () => void; divided: boolean }) {
    const theme = useTheme()
    const label = box.name || UNNAMED_BOX_LABEL
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.lg, borderTopWidth: divided ? 1 : 0, borderTopColor: theme.border, backgroundColor: pressed ? theme.muted : 'transparent' })}>
            <SymbolView name="square.dashed" size={16} tintColor={theme.mutedForeground} />
            <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                {label}
            </AppText>
            {selected && <SymbolView name="checkmark" size={16} weight="semibold" tintColor={theme.scheme === 'dark' ? brand.soft : brand.base} />}
        </Pressable>
    )
}

// A new coworker in one of the Boxes the caller manages. What it should do is also its first message,
// so it starts working as soon as it exists, as on the web. `box` preselects a Box.
export default function NewCoworker() {
    const theme = useTheme()
    const insets = useSafeAreaInsets()
    const { box: preselected } = useLocalSearchParams<{ box?: string }>()
    const { session, me } = useAuth()
    const [boxes, setBoxes] = useState<Box[] | null>(null)
    const [boxId, setBoxId] = useState<string | null>(preselected ?? null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [creating, setCreating] = useState(false)
    const [failed, setFailed] = useState(false)
    const workspaceAdmin = useIsWorkspaceAdmin()
    const accessToken = session?.access_token
    const workspaceId = me?.workspace.id

    useEffect(() => {
        if (!accessToken || !workspaceId) return
        fetchBoxes({ accessToken, workspaceId })
            .then(list => {
                const manageable = manageableBoxes(list)
                setBoxes(manageable)
                setBoxId(current => boxForNewCoworker(manageable, current))
            })
            .catch(() => setFailed(true))
    }, [accessToken, workspaceId])

    const blocked = newCoworkerBlocker({ failed, manageable: boxes, admin: workspaceAdmin })

    const create = async () => {
        if (!accessToken || !workspaceId || !boxId || !name.trim()) return
        setCreating(true)
        try {
            const created = await createCoworker({ accessToken, workspaceId }, { name: name.trim(), description: description.trim() || undefined, spaceId: boxId })
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            router.replace({ pathname: '/chat/[id]', params: { id: created.sessionId ?? 'new', to: created.agentId } })
            if (!created.active) Alert.alert(`${name.trim()} is paused`, 'Your plan has no free coworker slot. Start Pro at rerun.build for unlimited coworkers.')
        } catch (err) {
            setCreating(false)
            Alert.alert('Could not create the coworker', err instanceof Error ? err.message : 'Try again in a moment.')
        }
    }

    // A form sheet lays out its scroll view itself: wrapped in a view, it is laid out at no height.
    return (
        <ScrollView style={{ backgroundColor: theme.background }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <GlassButton symbol="xmark" label="Close" onPress={() => router.back()} />
                <AppText variant="headline" numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ flex: 1, textAlign: 'center' }}>
                    New coworker
                </AppText>
                <View style={{ width: GLASS_BUTTON_SIZE }} />
            </View>

            {blocked ? (
                <AppText variant="callout" tone="muted">
                    {blocked}
                </AppText>
            ) : (
                <>
                    <TextField id="coworker-name" label="Name" value={name} onChangeText={setName} placeholder="Scout" maxLength={NAME_MAX} autoFocus />
                    <TextField id="coworker-description" label="What should it do?" value={description} onChangeText={setDescription} placeholder="Find marketing agencies in Lyon and draft a first email to each" multiline help="Its first task. It starts on it right away." />
                </>
            )}

            {boxes && boxes.length > 0 && (
                <View style={{ gap: spacing.sm }}>
                    <AppText variant="footnote" medium>
                        Box
                    </AppText>
                    <View style={{ borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: theme.card, overflow: 'hidden' }}>
                        {boxes.map((box, index) => (
                            <BoxRow key={box.id} box={box} selected={box.id === boxId} divided={index > 0} onPress={() => setBoxId(box.id)} />
                        ))}
                    </View>
                </View>
            )}
            {!blocked && <PillButton label="Create" onPress={create} loading={creating} disabled={!name.trim() || !boxId} />}
        </ScrollView>
    )
}
